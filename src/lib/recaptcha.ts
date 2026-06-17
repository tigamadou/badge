const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
const MIN_SCORE = 0.5;

export type RecaptchaResult =
  | { ok: true; score?: number }
  | { ok: false; code: "MISSING_TOKEN" | "LOW_SCORE" | "REJECTED" | "NETWORK"; details?: unknown };

export async function verifyRecaptcha(input: {
  enabled: boolean;
  secretKey: string;
  token: string;
  remoteIp?: string;
}): Promise<RecaptchaResult> {
  if (!input.enabled) return { ok: true };
  if (!input.token) return { ok: false, code: "MISSING_TOKEN" };

  try {
    const body = new URLSearchParams({ secret: input.secretKey, response: input.token });
    if (input.remoteIp) body.set("remoteip", input.remoteIp);
    const resp = await fetch(VERIFY_URL, { method: "POST", body });
    const data = (await resp.json()) as { success: boolean; score?: number; "error-codes"?: string[] };
    if (!data.success) return { ok: false, code: "REJECTED", details: data["error-codes"] };
    if (typeof data.score === "number" && data.score < MIN_SCORE) {
      return { ok: false, code: "LOW_SCORE", details: { score: data.score } };
    }
    return { ok: true, score: data.score };
  } catch (err) {
    return { ok: false, code: "NETWORK", details: String(err) };
  }
}
