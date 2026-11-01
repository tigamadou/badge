import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { toast } from "sonner";
import {
  toastSuccess,
  toastError,
  toastInfo,
  toastApiError,
  apiErrorMessage,
  ActionError,
  DEFAULT_ERROR_MESSAGE,
} from "@/lib/toast";

const json = (body: unknown, status = 400) => new Response(JSON.stringify(body), { status });

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

  it("toastInfo délègue à sonner", () => {
    toastInfo("Info.");
    expect(toast.info).toHaveBeenCalledWith("Info.");
  });

  it("affiche le champ error d'une réponse API", async () => {
    const message = "Seules les inscriptions rejetées peuvent être resoumises.";
    await toastApiError(
      new Response(JSON.stringify({ code: "INVALID_STATE", error: message }), { status: 409 }),
      "repli",
    );
    expect(toast.error).toHaveBeenCalledWith(message);
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

  it("toastApiError affiche le message d'une ActionError", async () => {
    await toastApiError(new ActionError("Impossible : c'est le dernier OWNER."), "repli");
    expect(toast.error).toHaveBeenCalledWith("Impossible : c'est le dernier OWNER.");
  });
});

describe("apiErrorMessage", () => {
  it("privilégie le message d'une ActionError", async () => {
    expect(await apiErrorMessage(new ActionError("Dit en français."))).toBe("Dit en français.");
  });

  it("lit le champ message d'une réponse", async () => {
    const message = "Seules les inscriptions approuvées peuvent être imprimées.";
    expect(await apiErrorMessage(json({ message }, 409))).toBe(message);
  });

  it("lit un champ error lisible", async () => {
    const error = "Un compte avec cet email existe déjà.";
    expect(await apiErrorMessage(json({ error }))).toBe(error);
  });

  it("remplace un code technique par le repli", async () => {
    expect(await apiErrorMessage(json({ error: "NOT_FOUND" }, 404))).toBe(DEFAULT_ERROR_MESSAGE);
    expect(await apiErrorMessage(json({ error: "Unauthorized" }, 401))).toBe(DEFAULT_ERROR_MESSAGE);
  });

  it("remplace un message anglais connu par le repli", async () => {
    for (const error of [
      "Rate limited",
      "Not found",
      "Missing orgId",
      "Missing orgId or eventId",
      "Last OWNER cannot be removed",
      "Bad request",
    ]) {
      expect(await apiErrorMessage(json({ error }), "repli")).toBe("repli");
    }
  });

  it("retombe sur le repli pour un corps HTML, une erreur réseau ou une valeur vide", async () => {
    expect(await apiErrorMessage(new Response("<html>", { status: 502 }))).toBe(DEFAULT_ERROR_MESSAGE);
    expect(await apiErrorMessage(new TypeError("Failed to fetch"))).toBe(DEFAULT_ERROR_MESSAGE);
    expect(await apiErrorMessage(undefined)).toBe(DEFAULT_ERROR_MESSAGE);
    expect(await apiErrorMessage(json({ message: "" }))).toBe(DEFAULT_ERROR_MESSAGE);
  });

  it("utilise le repli fourni", async () => {
    expect(await apiErrorMessage(new TypeError("x"), "Échec de l'archivage.")).toBe("Échec de l'archivage.");
  });
});
