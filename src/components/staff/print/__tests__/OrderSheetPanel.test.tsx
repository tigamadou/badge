import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OrderSheetPanel } from "../OrderSheetPanel";
import type { OrderSheetView } from "@/lib/print-sheets/order-sheet";

const base: OrderSheetView = {
  generationId: "g1",
  status: "DONE",
  layoutName: "A4 recto",
  duplex: false,
  badgeCount: 12,
  sheetCount: 3,
  pageCount: 3,
  completedAt: "2026-11-02T10:00:00.000Z",
  error: null,
  downloadUrl: "/api/files/print-sheets/g1.pdf",
};
const render = (sheet: OrderSheetView | null) =>
  renderToStaticMarkup(<OrderSheetPanel sheet={sheet} sheetsHref="/platform/print/sheets" />);

describe("OrderSheetPanel", () => {
  it("à générer : aucune planche", () => {
    const html = render(null);
    expect(html).toContain("À générer");
    expect(html).not.toContain("Télécharger");
    expect(html).toContain('href="/platform/print/sheets"');
  });

  it("en cours", () => {
    const html = render({ ...base, status: "RUNNING", downloadUrl: null, badgeCount: null, sheetCount: null, pageCount: null });
    expect(html).toContain("En cours");
    expect(html).not.toContain("Télécharger");
  });

  it("prête : chiffres, téléchargement et aperçu", () => {
    const html = render({ ...base, duplex: true, pageCount: 6 });
    expect(html).toContain("Prête");
    expect(html).toContain("12 badges");
    expect(html).toContain("3 feuilles");
    expect(html).toContain("6 pages");
    expect(html).toContain("recto-verso");
    expect(html).toContain('href="/api/files/print-sheets/g1.pdf"');
    expect(html).toContain("Télécharger");
    expect(html).toContain("Voir la planche");
    expect(html).toContain("Gérer dans Planches");
  });

  it("prête recto seul", () => {
    expect(render(base)).toContain("recto seul");
  });

  it("échec sans message : texte générique", () => {
    expect(render({ ...base, status: "FAILED", error: null, downloadUrl: null })).toContain("La génération a échoué.");
  });

  it("échec : message d'erreur, pas de téléchargement", () => {
    const html = render({ ...base, status: "FAILED", error: "boom", downloadUrl: null });
    expect(html).toContain("Échec");
    expect(html).toContain("boom");
    expect(html).not.toContain("Télécharger");
  });
});
