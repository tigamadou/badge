import type { Permission } from "@/lib/permissions/catalog";
import { describe, it, expect } from "vitest";
import { computeOnsiteCounter } from "@/lib/print-requests/onsite-counter";
import {
  counterView,
  fetchOnsiteRefusal,
  onsiteRefusal,
  showsOnsiteCounter,
  canOpenOnsiteStation,
  canSetOnsiteMargin,
  alreadyPrintedLabel,
} from "@/lib/print-requests/onsite-station-view";

const c = (printed: number, ordered = 200, margin = 10) =>
  computeOnsiteCounter({ ordered, marginPercent: margin, printed });

describe("counterView", () => {
  it("niveaux et textes", () => {
    expect(counterView(c(179))).toMatchObject({ summary: "179 / 200 badges imprimés", tone: "ok", notice: null });
    expect(counterView(c(180))).toMatchObject({ tone: "warn", notice: "90 % de la commande atteinte" });
    expect(counterView(c(212))).toMatchObject({
      tone: "warn",
      notice: "12 badges au-delà de la commande, facturés après l'évènement",
    });
    expect(counterView(c(201)).notice).toBe("1 badge au-delà de la commande, facturé après l'évènement");
    expect(counterView(c(220))).toMatchObject({ tone: "err", notice: "Plafond atteint (220) : l'impression est bloquée" });
  });
  it("pourcentage borné, commande vide sans division par zéro", () => {
    expect(counterView(c(100)).pct).toBe(50);
    expect(counterView(c(212)).pct).toBe(100);
    expect(counterView(c(0, 0, 0)).pct).toBe(0);
  });
});

describe("onsiteRefusal", () => {
  it("réimpression : date de la première impression", () => {
    const r = onsiteRefusal({ error: "ALREADY_PRINTED", printedAt: "2026-11-02T10:30:00.000Z" });
    expect(r.kind).toBe("REPRINT");
    expect(r.message).toMatch(/^Déjà imprimé le \d{2}\/\d{2}\/\d{4}/);
  });
  it("réimpression sans date exploitable", () => {
    expect(onsiteRefusal({ error: "ALREADY_PRINTED" })).toEqual({ kind: "REPRINT", message: "Déjà imprimé" });
    expect(onsiteRefusal({ error: "ALREADY_PRINTED", printedAt: "n'importe quoi" }).message).toBe("Déjà imprimé");
  });
  it("inscription non approuvée avec son statut", () => {
    expect(onsiteRefusal({ error: "NOT_APPROVED", status: "PENDING" })).toEqual({
      kind: "REFUSED",
      message: "Inscription non approuvée (en attente) : le poste n'approuve personne.",
    });
    expect(onsiteRefusal({ error: "NOT_APPROVED", status: "REJECTED" }).message).toContain("(refusée)");
    expect(onsiteRefusal({ error: "NOT_APPROVED" }).message).toBe(
      "Inscription non approuvée : le poste n'approuve personne.",
    );
    expect(onsiteRefusal({ error: "NOT_APPROVED", status: "AUTRE" }).message).toBe(
      "Inscription non approuvée : le poste n'approuve personne.",
    );
  });
  it("autres codes : message français du serveur", () => {
    expect(onsiteRefusal({ error: "FOREIGN_EVENT", message: "Ce QR ne correspond pas à cet évènement." })).toEqual({
      kind: "REFUSED",
      message: "Ce QR ne correspond pas à cet évènement.",
    });
    expect(onsiteRefusal({ error: "CAP_REACHED", message: "Plafond." }).message).toBe("Plafond.");
  });
  it("code inconnu : message du serveur, sinon repli générique", () => {
    expect(onsiteRefusal({ error: "X", message: "" }).message).toBe("Opération impossible. Réessayez.");
    expect(onsiteRefusal({ error: "X" }).message).toBe("Opération impossible. Réessayez.");
    expect(onsiteRefusal(null).message).toBe("Opération impossible. Réessayez.");
    expect(onsiteRefusal("texte").message).toBe("Opération impossible. Réessayez.");
  });
});

describe("alreadyPrintedLabel", () => {
  it("date valide, absente ou invalide", () => {
    expect(alreadyPrintedLabel("2026-11-02T10:30:00.000Z")).toMatch(/^Déjà imprimé le /);
    expect(alreadyPrintedLabel(null)).toBe("Déjà imprimé");
  });
});

describe("fetchOnsiteRefusal", () => {
  it("lit le corps JSON", async () => {
    const res = new Response(JSON.stringify({ error: "CAP_REACHED", message: "Plafond." }), { status: 409 });
    expect((await fetchOnsiteRefusal(res)).message).toBe("Plafond.");
  });
  it("corps illisible : repli", async () => {
    expect((await fetchOnsiteRefusal(new Response("<html>", { status: 500 }))).message).toBe(
      "Opération impossible. Réessayez.",
    );
  });
});

describe("statuts", () => {
  it("compteur visible dès le paiement", () => {
    for (const s of ["PAID", "IN_PRODUCTION", "READY", "COMPLETED"]) expect(showsOnsiteCounter(s)).toBe(true);
    for (const s of ["DRAFT", "SUBMITTED", "QUOTED", "ACCEPTED", "CANCELLED"]) expect(showsOnsiteCounter(s)).toBe(false);
  });
  it("poste ouvert pendant l'impression seulement", () => {
    for (const s of ["PAID", "IN_PRODUCTION", "READY"]) expect(canOpenOnsiteStation(s)).toBe(true);
    expect(canOpenOnsiteStation("COMPLETED")).toBe(false);
  });
  it("marge avec un ensemble de permissions : vrai ssi `print.onsite.margin.update`", () => {
    const granted = new Set<Permission>(["print.onsite.margin.update"]);
    expect(canSetOnsiteMargin("READY", granted)).toBe(true);
    expect(canSetOnsiteMargin("READY", new Set<Permission>(["print.request"]))).toBe(false);
    expect(canSetOnsiteMargin("COMPLETED", granted)).toBe(false);
  });
});
