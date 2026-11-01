import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PaymentHistory } from "../PaymentHistory";

const base = {
  id: "p1",
  createdAt: new Date("2026-10-28T10:00:00Z"),
  planName: "Pro",
  amount: 15000,
  status: "APPROVED" as const,
  fedapayReference: "REF-1",
};

describe("PaymentHistory", () => {
  it("affiche un état vide", () => {
    expect(renderToStaticMarkup(<PaymentHistory payments={[]} />)).toContain("Aucun paiement.");
  });

  it("affiche plan, montant FCFA et référence", () => {
    const html = renderToStaticMarkup(<PaymentHistory payments={[base]} />);
    expect(html).toContain("Pro");
    expect(html).toContain("REF-1");
    expect(html.replace(/[  ]/g, " ")).toContain("15 000 FCFA");
  });

  it("traduit chaque statut", () => {
    const labels = {
      PENDING: "En attente",
      APPROVED: "Payé",
      DECLINED: "Refusé",
      CANCELED: "Annulé",
      EXPIRED: "Expiré",
    } as const;
    for (const [status, label] of Object.entries(labels)) {
      const html = renderToStaticMarkup(
        <PaymentHistory payments={[{ ...base, status: status as keyof typeof labels }]} />,
      );
      expect(html).toContain(label);
    }
  });

  it("affiche un tiret sans référence", () => {
    const html = renderToStaticMarkup(<PaymentHistory payments={[{ ...base, fedapayReference: null }]} />);
    expect(html).toContain("—");
  });
});
