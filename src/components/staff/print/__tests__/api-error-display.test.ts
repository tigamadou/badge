import { afterEach, describe, expect, it, vi } from "vitest";

const toastError = vi.fn();
const toastApiError = vi.fn();
vi.mock("@/lib/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/toast")>()),
  toastError: (m: string) => toastError(m),
  toastApiError: (r: unknown) => toastApiError(r),
}));

import { apiErrorMessage, DEFAULT_ERROR_MESSAGE } from "@/lib/toast";
import { staffRequest } from "../request-fetch";

const MESSAGE = "Le logo doit être recadré.";

function response(body: unknown, status = 409) {
  return new Response(JSON.stringify(body), { status });
}

function stubFetch(body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(body)));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("erreurs EVENT_IMAGES_NONCOMPLIANT", () => {
  it("apiErrorMessage renvoie le message français de l'API", async () => {
    const text = await apiErrorMessage(response({ error: "EVENT_IMAGES_NONCOMPLIANT", message: MESSAGE }));
    expect(text).toBe(MESSAGE);
  });

  it("apiErrorMessage n'affiche jamais le code technique sans message", async () => {
    const text = await apiErrorMessage(response({ error: "EVENT_IMAGES_NONCOMPLIANT" }));
    expect(text).toBe(DEFAULT_ERROR_MESSAGE);
  });

  it("staffRequest transmet la réponse à toastApiError sans codeMessages", async () => {
    stubFetch({ error: "EVENT_IMAGES_NONCOMPLIANT", message: MESSAGE });
    expect(await staffRequest("/x", "POST")).toBeNull();
    expect(toastApiError).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
    const sent = toastApiError.mock.calls[0][0] as Response;
    expect(await apiErrorMessage(sent)).toBe(MESSAGE);
  });

  it("staffRequest laisse passer le message de l'API quand codeMessages ne contient pas le code", async () => {
    stubFetch({ error: "EVENT_IMAGES_NONCOMPLIANT", message: MESSAGE });
    expect(await staffRequest("/x", "POST", undefined, { PAYMENT_IN_PROGRESS: "Paiement en cours." })).toBeNull();
    expect(toastApiError).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });
});
