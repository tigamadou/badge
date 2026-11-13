import { afterEach, describe, expect, it, vi } from "vitest";

const toastError = vi.fn();
const toastApiError = vi.fn();
vi.mock("@/lib/toast", () => ({ toastError: (m: string) => toastError(m), toastApiError: (r: unknown) => toastApiError(r) }));

import { requestUrl, staffRequest } from "../request-fetch";

const MESSAGES = { PAYMENT_IN_PROGRESS: "Un paiement FedaPay est en cours sur cette commande." };

function respond(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("staffRequest", () => {
  it("remplace le message de l'API pour un code connu", async () => {
    respond(409, { error: "PAYMENT_IN_PROGRESS", message: "autre" });
    expect(await staffRequest("/x", "POST", { a: 1 }, MESSAGES)).toBeNull();
    expect(toastError).toHaveBeenCalledWith(MESSAGES.PAYMENT_IN_PROGRESS);
    expect(toastApiError).not.toHaveBeenCalled();
  });

  it("garde le message de l'API pour un autre code", async () => {
    respond(409, { error: "OTHER", message: "autre" });
    expect(await staffRequest("/x", "POST", undefined, MESSAGES)).toBeNull();
    expect(toastApiError).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("renvoie la réponse en cas de succès", async () => {
    respond(200, {});
    expect(await staffRequest("/x", "POST")).not.toBeNull();
  });
});

describe("requestUrl", () => {
  it("garde la base plateforme par défaut", () => {
    expect(requestUrl("r1", "/onsite/lookup")).toBe("/api/platform/print/requests/r1/onsite/lookup");
    expect(requestUrl("r1")).toBe("/api/platform/print/requests/r1");
  });

  it("utilise la base fournie", () => {
    const base = "/api/org/o1/events/e1/print-requests/r1";
    expect(requestUrl("r1", "/onsite/lookup", base)).toBe(`${base}/onsite/lookup`);
    expect(requestUrl("r1", "", base)).toBe(base);
  });
});
