import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { OrderQueueTable } from "../OrderQueueTable";
import type { OrderQueueRow } from "@/lib/print-sheets/order-queue";

const sheet = (status: "PENDING" | "RUNNING" | "DONE" | "FAILED"): NonNullable<OrderQueueRow["sheet"]> => ({
  generationId: "g1",
  status,
  layoutName: "A4",
  duplex: false,
  badgeCount: 3,
  sheetCount: 1,
  pageCount: 1,
  completedAt: null,
  error: status === "FAILED" ? "Rendu impossible" : null,
  downloadUrl: status === "DONE" ? "/api/files/print-sheets/g1.pdf" : null,
});

const row = (status: "PENDING" | "RUNNING" | "DONE" | "FAILED" | null): OrderQueueRow => ({
  requestId: "r1",
  reference: "PR-001",
  status: "PAID",
  eventId: "e1",
  eventTitle: "Salon",
  orgName: "Org",
  badgeCount: 3,
  badgePages: 1,
  paidAt: null,
  sheet: status ? sheet(status) : null,
});

const render = (mode: "pending" | "generated", r: OrderQueueRow, canGenerate = true) =>
  renderToStaticMarkup(<OrderQueueTable mode={mode} initial={[r]} layouts={[]} canGenerate={canGenerate} />);

describe("OrderQueueTable", () => {
  it("À traiter, sans planche : bouton Générer actif", () => {
    const html = render("pending", row(null));
    expect(html).toContain("Générer");
    expect(html).not.toContain('disabled=""');
  });

  it("À traiter, génération en cours : état et bouton Regénérer désactivé", () => {
    const html = render("pending", row("RUNNING"));
    expect(html).toContain("Génération en cours…");
    expect(html).toContain("Regénérer");
    expect(html).toContain('disabled=""');
  });

  it("En attente : même présentation que « en cours »", () => {
    const html = render("generated", row("PENDING"));
    expect(html).toContain("En attente…");
    expect(html).toContain('disabled=""');
  });

  it("Échec : message affiché et Regénérer actif", () => {
    const html = render("pending", row("FAILED"));
    expect(html).toContain("Rendu impossible");
    expect(html).toContain("Regénérer");
    expect(html).not.toContain('disabled=""');
  });

  it("Générées, prête : téléchargement et Regénérer", () => {
    const html = render("generated", row("DONE"));
    expect(html).toContain("Prête");
    expect(html).toContain("Télécharger");
    expect(html).toContain("Regénérer");
  });

  it("sans print.sheets.generate : aucun bouton de génération", () => {
    expect(render("pending", row(null), false)).not.toContain("Générer");
    expect(render("generated", row("DONE"), false)).not.toContain("Regénérer");
  });
});
