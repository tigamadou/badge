import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GenerationStatePill } from "../GenerationStatePill";

const render = (status: "PENDING" | "RUNNING" | "DONE" | "FAILED", error?: string | null) =>
  renderToStaticMarkup(<GenerationStatePill status={status} doneLabel="Prête" error={error} />);

describe("GenerationStatePill", () => {
  it("PENDING : spinner et « En attente… »", () => {
    const html = render("PENDING");
    expect(html).toContain("En attente…");
    expect(html).toContain('role="status"');
  });

  it("RUNNING : spinner et « Génération en cours… »", () => {
    const html = render("RUNNING");
    expect(html).toContain("Génération en cours…");
    expect(html).toContain('role="status"');
  });

  it("DONE : libellé fourni, sans spinner", () => {
    const html = render("DONE");
    expect(html).toContain("Prête");
    expect(html).not.toContain('role="status"');
  });

  it("FAILED : « Échec » avec le message, ou « Erreur inconnue. »", () => {
    const withError = render("FAILED", "Rendu impossible");
    expect(withError).toContain("Échec");
    expect(withError).toContain("Rendu impossible");
    expect(withError).not.toContain('role="status"');
    expect(render("FAILED", null)).toContain("Erreur inconnue.");
  });
});
