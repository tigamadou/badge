import { createHmac, timingSafeEqual } from "node:crypto";

export type FedapayTransactionStatus =
  | "pending"
  | "approved"
  | "declined"
  | "canceled"
  | "refunded"
  | "transferred"
  | string;

export type FedapayTransaction = {
  id: number;
  reference: string;
  amount: number;
  currencyIso: string;
  status: FedapayTransactionStatus;
};

export type FedapayErrorCode = "NOT_CONFIGURED" | "API_ERROR" | "BAD_SIGNATURE";

export class FedapayError extends Error {
  readonly code: FedapayErrorCode;
  readonly httpStatus?: number;

  constructor(code: FedapayErrorCode, message: string, httpStatus?: number) {
    super(message);
    this.name = "FedapayError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type FedapayEnvironment = "SANDBOX" | "LIVE";

export type FedapayConfig = {
  environment: FedapayEnvironment;
  secretKey: string;
  webhookSecret: string;
  configured: boolean;
};

// Configuration lue dans les variables d'environnement a chaque appel (decision 2026-10-28) :
// jamais en base ni dans une reponse API. Toute valeur autre que « live » donne le sandbox.
export function getFedapayConfig(): FedapayConfig {
  const secretKey = (process.env.FEDAPAY_SECRET_KEY ?? "").trim();
  const webhookSecret = (process.env.FEDAPAY_WEBHOOK_SECRET ?? "").trim();
  return {
    environment: process.env.FEDAPAY_ENVIRONMENT === "live" ? "LIVE" : "SANDBOX",
    secretKey,
    webhookSecret,
    configured: secretKey !== "" && webhookSecret !== "",
  };
}

const WEBHOOK_TOLERANCE_SEC = 300;
const REQUEST_TIMEOUT_MS = 10_000;

export function fedapayBaseUrl(env: FedapayEnvironment): string {
  return env === "LIVE" ? "https://api.fedapay.com/v1" : "https://sandbox-api.fedapay.com/v1";
}

export function isPaidStatus(status: FedapayTransactionStatus): boolean {
  return status === "approved" || status === "transferred";
}

async function request(method: "GET" | "POST", path: string, payload?: unknown): Promise<Record<string, unknown>> {
  const { environment, secretKey, configured } = getFedapayConfig();
  if (!configured) {
    throw new FedapayError("NOT_CONFIGURED", "FedaPay n'est pas configuré");
  }
  let res: Response;
  try {
    res = await fetch(`${fedapayBaseUrl(environment)}${path}`, {
      method,
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // Message générique : l'erreur d'origine peut contenir l'URL ou des détails sensibles.
    throw new FedapayError("API_ERROR", "FedaPay injoignable");
  }
  if (!res.ok) {
    throw new FedapayError("API_ERROR", `FedaPay a répondu ${res.status}`, res.status);
  }
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    throw new FedapayError("API_ERROR", "Réponse FedaPay illisible", res.status);
  }
}

function parseTransaction(body: Record<string, unknown>): FedapayTransaction {
  // Vérifié en sandbox (2026-10-28) : la lecture renvoie l'enveloppe { "v1/transaction": {...} }
  const raw = (body["v1/transaction"] ?? body) as Record<string, unknown>;
  // Vérifié en sandbox (2026-10-28) : la transaction n'a PAS d'objet `currency`, seulement
  // `currency_id` (1 = XOF). Tout autre identifiant donne une valeur qui ne vaut jamais « XOF ».
  const iso = (raw.currency as { iso?: unknown } | undefined)?.iso;
  let currencyIso = "";
  if (typeof iso === "string") currencyIso = iso;
  else if (typeof raw.currency_id === "number") {
    currencyIso = raw.currency_id === 1 ? "XOF" : `currency_id:${raw.currency_id}`;
  }
  if (typeof raw.id !== "number" || typeof raw.amount !== "number" || typeof raw.status !== "string") {
    throw new FedapayError("API_ERROR", "Transaction FedaPay mal formée");
  }
  return {
    id: raw.id,
    reference: typeof raw.reference === "string" ? raw.reference : "",
    amount: raw.amount,
    currencyIso,
    status: raw.status,
  };
}

export async function createTransaction(input: {
  description: string;
  amount: number;
  callbackUrl: string;
  customer: { email: string; firstname?: string; lastname?: string };
  metadata: Record<string, string>;
}): Promise<FedapayTransaction> {
  const body = await request("POST", "/transactions", {
    description: input.description,
    amount: input.amount,
    callback_url: input.callbackUrl,
    currency: { iso: "XOF" },
    customer: input.customer,
    custom_metadata: input.metadata,
  });
  return parseTransaction(body);
}

export async function createPaymentUrl(transactionId: number): Promise<string> {
  const body = await request("POST", `/transactions/${transactionId}/token`);
  const raw = (body["v1/token"] ?? body) as { url?: unknown };
  if (typeof raw.url !== "string") {
    throw new FedapayError("API_ERROR", "URL de paiement FedaPay absente");
  }
  return raw.url;
}

export async function retrieveTransaction(transactionId: number): Promise<FedapayTransaction> {
  const tx = parseTransaction(await request("GET", `/transactions/${transactionId}`));
  if (tx.id !== transactionId) {
    throw new FedapayError("API_ERROR", "Transaction FedaPay inattendue");
  }
  return tx;
}

// Reproduit fedapay@1.2.5 (Webhook.js) : en-tête "t=<unix>,s=<hex>[,s=<hex>]",
// HMAC-SHA256 de "<t>.<corps brut>", tolérance de 300 s.
export function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): void {
  const fail = (msg: string) => new FedapayError("BAD_SIGNATURE", msg);
  if (!header) throw fail("En-tête de signature absent");

  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const item of header.split(",")) {
    const [key, value] = item.split("=");
    if (key === "t") timestamp = parseInt(value, 10);
    if (key === "s" && value) signatures.push(value);
  }
  if (timestamp === null || Number.isNaN(timestamp)) throw fail("Horodatage de signature absent");
  if (signatures.length === 0) throw fail("Aucune signature");

  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex"),
  );
  const match = signatures.some((s) => {
    const candidate = Buffer.from(s);
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
  if (!match) throw fail("Signature invalide");
  if (Math.abs(nowSec - timestamp) > WEBHOOK_TOLERANCE_SEC) throw fail("Horodatage hors tolérance");
}
