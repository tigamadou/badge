import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { toastSuccess, toastError, toastApiError, DEFAULT_ERROR_MESSAGE } from "@/lib/toast";

beforeEach(() => {
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe("toast", () => {
  it("toastSuccess et toastError délèguent à sonner", () => {
    toastSuccess("Fait.");
    toastError("Raté.");
    expect(toast.success).toHaveBeenCalledWith("Fait.");
    expect(toast.error).toHaveBeenCalledWith("Raté.");
  });

  it("affiche le champ error d'une réponse API", async () => {
    const message = "Seules les inscriptions rejetées peuvent être resoumises.";
    await toastApiError(
      new Response(JSON.stringify({ code: "INVALID_STATE", error: message }), { status: 409 }),
      "repli",
    );
    expect(toast.error).toHaveBeenCalledWith(message);
  });

  it("affiche le champ error d'un objet déjà lu", async () => {
    await toastApiError({ error: "Accès refusé." });
    expect(toast.error).toHaveBeenCalledWith("Accès refusé.");
  });

  it("retombe sur le repli pour un corps non JSON, un corps déjà lu ou une erreur réseau", async () => {
    const consumed = new Response("déjà lu", { status: 500 });
    await consumed.text();
    const sources: unknown[] = [
      new Response("<html>", { status: 500 }),
      consumed,
      new TypeError("Failed to fetch"),
      undefined,
      { error: "" },
      { error: 42 },
      new Response(JSON.stringify({ error: "" }), { status: 400 }),
      new Response(JSON.stringify(null), { status: 400 }),
    ];
    for (const source of sources) {
      vi.mocked(toast.error).mockClear();
      await toastApiError(source);
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith(DEFAULT_ERROR_MESSAGE);
    }
  });

  it("utilise le repli fourni par l'appelant", async () => {
    await toastApiError(undefined, "Resoumission impossible.");
    expect(toast.error).toHaveBeenCalledWith("Resoumission impossible.");
  });
});
