import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FedapayError,
  createPaymentUrl,
  createTransaction,
  fedapayBaseUrl,
  getFedapayConfig,
  isPaidStatus,
  retrieveTransaction,
  verifyWebhookSignature,
} from "@/lib/fedapay";

const input = {
  description: "Abonnement Pro",
  amount: 15000,
  callbackUrl: "https://badge.local/org/o1/subscription/return",
  customer: { email: "a@b.fr", firstname: "A", lastname: "B" },
  metadata: { paymentId: "p1" },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

const tx = { id: 42, reference: "trx_1", amount: 15000, status: "pending", currency: { iso: "XOF" } };

describe("client FedaPay", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.stubEnv("FEDAPAY_ENVIRONMENT", "sandbox");
    vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_test");
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "whsec");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("createTransaction envoie montant, devise XOF, callback et Bearer", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ "v1/transaction": tx }));
    await createTransaction(input);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://sandbox-api.fedapay.com/v1/transactions");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer sk_test");
    expect(init.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      description: "Abonnement Pro",
      amount: 15000,
      callback_url: input.callbackUrl,
      currency: { iso: "XOF" },
      customer: { email: "a@b.fr", firstname: "A", lastname: "B" },
      custom_metadata: { paymentId: "p1" },
    });
  });

  it("createTransaction lit l'enveloppe v1/transaction", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ "v1/transaction": tx }));
    expect(await createTransaction(input)).toEqual({
      id: 42, reference: "trx_1", amount: 15000, currencyIso: "XOF", status: "pending",
    });
  });

  it("lit un objet sans enveloppe, devise absente -> chaine vide", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 1, reference: "r", amount: 5, status: "approved" }));
    expect(await retrieveTransaction(1)).toEqual({
      id: 1, reference: "r", amount: 5, currencyIso: "", status: "approved",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://sandbox-api.fedapay.com/v1/transactions/1");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("devise déduite de currency_id : 1 -> XOF", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ "v1/transaction": { id: 1, amount: 5, status: "approved", currency_id: 1 } }));
    expect((await retrieveTransaction(1)).currencyIso).toBe("XOF");
  });

  it("devise déduite de currency_id : autre identifiant -> valeur non vide jamais égale à XOF", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ "v1/transaction": { id: 1, amount: 5, status: "approved", currency_id: 2 } }));
    const { currencyIso } = await retrieveTransaction(1);
    expect(currencyIso).not.toBe("XOF");
    expect(currencyIso).not.toBe("");
  });

  it("currency.iso présent l'emporte sur currency_id", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ "v1/transaction": { id: 1, amount: 5, status: "approved", currency: { iso: "EUR" }, currency_id: 1 } }),
    );
    expect((await retrieveTransaction(1)).currencyIso).toBe("EUR");
  });

  it("ni currency.iso ni currency_id -> chaine vide", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ "v1/transaction": { id: 1, amount: 5, status: "approved" } }));
    expect((await retrieveTransaction(1)).currencyIso).toBe("");
  });

  it("référence absente -> chaine vide", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 1, amount: 5, status: "pending" }));
    expect((await retrieveTransaction(1)).reference).toBe("");
  });

  it("createPaymentUrl renvoie url", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ token: "t", url: "https://pay.fedapay.com/t" }));
    expect(await createPaymentUrl(42)).toBe("https://pay.fedapay.com/t");
    expect(fetchMock.mock.calls[0][0]).toBe("https://sandbox-api.fedapay.com/v1/transactions/42/token");
  });

  it("createPaymentUrl lit l'enveloppe v1/token", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ "v1/token": { url: "https://pay.fedapay.com/x" } }));
    expect(await createPaymentUrl(42)).toBe("https://pay.fedapay.com/x");
  });

  it("createPaymentUrl sans url -> API_ERROR", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await expect(createPaymentUrl(42)).rejects.toMatchObject({ code: "API_ERROR" });
  });

  it("réponse non 2xx → FedapayError API_ERROR avec httpStatus", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: "no" }, 401));
    const err = await retrieveTransaction(1).catch((e) => e);
    expect(err).toBeInstanceOf(FedapayError);
    expect(err.code).toBe("API_ERROR");
    expect(err.httpStatus).toBe(401);
  });

  it("fetch rejeté (réseau, timeout) → API_ERROR sans fuite du secret", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed sk_test"));
    const err = await retrieveTransaction(1).catch((e) => e);
    expect(err).toBeInstanceOf(FedapayError);
    expect(err.code).toBe("API_ERROR");
    expect(err.message).not.toContain("sk_test");
  });

  it("le fetch porte un signal de timeout", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ "v1/transaction": { ...tx, id: 1 } }));
    await retrieveTransaction(1);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("retrieveTransaction : identifiant retourné différent → API_ERROR", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ "v1/transaction": tx }));
    await expect(retrieveTransaction(43)).rejects.toMatchObject({ code: "API_ERROR" });
  });

  it("réponse non JSON → API_ERROR", async () => {
    fetchMock.mockResolvedValue(new Response("oops", { status: 200 }));
    await expect(retrieveTransaction(1)).rejects.toMatchObject({ code: "API_ERROR" });
  });

  it("transaction mal formée → API_ERROR", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ "v1/transaction": { id: "x" } }));
    await expect(retrieveTransaction(1)).rejects.toMatchObject({ code: "API_ERROR" });
  });

  it("non configuré → FedapayError NOT_CONFIGURED sans appel fetch", async () => {
    vi.stubEnv("FEDAPAY_SECRET_KEY", "");
    await expect(createTransaction(input)).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("environnement LIVE → https://api.fedapay.com/v1", async () => {
    vi.stubEnv("FEDAPAY_ENVIRONMENT", "live");
    fetchMock.mockResolvedValue(jsonResponse({ "v1/transaction": tx }));
    await retrieveTransaction(42);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.fedapay.com/v1/transactions/42");
    expect(fedapayBaseUrl("LIVE")).toBe("https://api.fedapay.com/v1");
  });

  it("isPaidStatus", () => {
    expect(isPaidStatus("approved")).toBe(true);
    expect(isPaidStatus("transferred")).toBe(true);
    expect(isPaidStatus("pending")).toBe(false);
  });
});

describe("verifyWebhookSignature", () => {
  const secret = "whsec";
  const body = '{"name":"transaction.approved"}';
  const now = 1_700_000_000;
  const sign = (t: number, b = body, s = secret) =>
    createHmac("sha256", s).update(`${t}.${b}`, "utf8").digest("hex");

  it("accepte une signature calculée avec le secret", () => {
    expect(() => verifyWebhookSignature(body, `t=${now},s=${sign(now)}`, secret, now)).not.toThrow();
  });

  it("utilise l'horloge courante par défaut", () => {
    const t = Math.floor(Date.now() / 1000);
    expect(() => verifyWebhookSignature(body, `t=${t},s=${sign(t)}`, secret)).not.toThrow();
  });

  it("rejette : en-tête absent, sans t, sans s, mauvais secret, corps modifié, horodatage > 300 s", () => {
    const bad = (h: string | null, b = body, s = secret, n = now) => {
      expect(() => verifyWebhookSignature(b, h, s, n)).toThrowError(FedapayError);
      try {
        verifyWebhookSignature(b, h, s, n);
      } catch (e) {
        expect((e as FedapayError).code).toBe("BAD_SIGNATURE");
      }
    };
    bad(null);
    bad(`s=${sign(now)}`);
    bad(`t=${now}`);
    bad(`t=abc,s=${sign(now)}`);
    bad(`t=${now},s=${sign(now, body, "autre")}`);
    bad(`t=${now},s=${sign(now)}`, body + " ");
    bad(`t=${now},s=abcd`);
    bad(`t=${now - 301},s=${sign(now - 301)}`);
    bad(`t=${now + 301},s=${sign(now + 301)}`);
  });

  it("accepte un horodatage à exactement 300 s dans le passé", () => {
    expect(() => verifyWebhookSignature(body, `t=${now - 300},s=${sign(now - 300)}`, secret, now)).not.toThrow();
  });

  it("accepte si l'une de plusieurs signatures s= correspond", () => {
    expect(() => verifyWebhookSignature(body, `t=${now},s=deadbeef,s=${sign(now)}`, secret, now)).not.toThrow();
  });

  it("ignore les segments sans valeur", () => {
    expect(() => verifyWebhookSignature(body, `x,t=${now},s=${sign(now)}`, secret, now)).not.toThrow();
  });
});

describe("getFedapayConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sandbox et non configuré par défaut", () => {
    vi.stubEnv("FEDAPAY_ENVIRONMENT", "");
    vi.stubEnv("FEDAPAY_SECRET_KEY", "");
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "");
    expect(getFedapayConfig()).toEqual({
      environment: "SANDBOX",
      secretKey: "",
      webhookSecret: "",
      configured: false,
    });
  });

  it("variables absentes : sandbox, non configuré", () => {
    vi.stubEnv("FEDAPAY_ENVIRONMENT", undefined);
    vi.stubEnv("FEDAPAY_SECRET_KEY", undefined);
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", undefined);
    expect(getFedapayConfig().environment).toBe("SANDBOX");
    expect(getFedapayConfig().configured).toBe(false);
  });

  it("« live » → LIVE, configuré avec les deux secrets", () => {
    vi.stubEnv("FEDAPAY_ENVIRONMENT", "live");
    vi.stubEnv("FEDAPAY_SECRET_KEY", " sk_x ");
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "wh_x");
    expect(getFedapayConfig()).toEqual({
      environment: "LIVE",
      secretKey: "sk_x",
      webhookSecret: "wh_x",
      configured: true,
    });
  });

  it("valeur inattendue → SANDBOX", () => {
    vi.stubEnv("FEDAPAY_ENVIRONMENT", "LIVE");
    expect(getFedapayConfig().environment).toBe("SANDBOX");
    vi.stubEnv("FEDAPAY_ENVIRONMENT", "production");
    expect(getFedapayConfig().environment).toBe("SANDBOX");
  });

  it("non configuré si un secret manque ou est blanc", () => {
    vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_x");
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "   ");
    expect(getFedapayConfig().configured).toBe(false);
    vi.stubEnv("FEDAPAY_SECRET_KEY", "");
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "wh_x");
    expect(getFedapayConfig().configured).toBe(false);
  });
});
