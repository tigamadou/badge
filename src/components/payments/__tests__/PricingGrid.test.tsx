import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PublicPlan } from "@/lib/public-plans";
import { PricingGrid } from "../PricingGrid";

const norm = (s: string) => s.replace(/[  ]/g, " ");

const plan = (over: Partial<PublicPlan> = {}): PublicPlan => ({
  id: "p1",
  name: "Pro",
  period: "MONTHLY",
  price: 15000,
  maxEvents: 10,
  maxParticipantsPerEvent: null,
  description: "Pour les équipes",
  features: ["Support e-mail"],
  highlighted: false,
  ...over,
});

const html = (plans: PublicPlan[]) => norm(renderToStaticMarkup(<PricingGrid plans={plans} />));

describe("PricingGrid", () => {
  it("prix en FCFA avec la période, limites et description", () => {
    const out = html([plan()]);
    expect(out).toContain("15 000 FCFA");
    expect(out).toContain("/ mois");
    expect(out).toContain("10 événements");
    expect(out).toContain("Participants illimités / événement");
    expect(out).toContain("Pour les équipes");
    expect(out).toContain("Support e-mail");
    expect(out).toContain('href="/login"');
    expect(out).toContain("Choisir ce plan");
  });

  it("annuel, singulier et grands nombres", () => {
    const out = html([plan({ period: "ANNUAL", maxEvents: 1, maxParticipantsPerEvent: 1500 })]);
    expect(out).toContain("/ an");
    expect(out).toContain("1 événement");
    expect(out).not.toContain("1 événements");
    expect(out).toContain("1 500 participants / événement");
  });

  it("illimité pour les limites nulles", () => {
    expect(html([plan({ maxEvents: null })])).toContain("Événements illimités");
  });

  it("plan sans prix : Nous contacter vers /contact", () => {
    const out = html([plan({ price: null })]);
    expect(out).toContain("Nous contacter");
    expect(out).toContain('href="/contact"');
    expect(out).toContain("Sur devis");
    expect(out).not.toContain("Choisir ce plan");
  });

  it("bascule seulement s'il existe des plans payants des deux périodes", () => {
    expect(html([plan()])).not.toContain("Période de facturation");
    expect(html([plan({ price: null, id: "x" }), plan({ id: "y", period: "ANNUAL" })])).not.toContain("Période de facturation");
    const both = html([plan({ name: "Mensuel A" }), plan({ id: "p2", name: "Annuel B", period: "ANNUAL", price: 150000 })]);
    expect(both).toContain("Période de facturation");
    expect(both).toContain('aria-pressed="true"');
  });

  it("mensuel par défaut : seuls les plans mensuels (et sans prix) sont montrés", () => {
    const out = html([
      plan({ name: "Mensuel A" }),
      plan({ id: "p2", name: "Annuel B", period: "ANNUAL", price: 150000 }),
      plan({ id: "p3", name: "Devis C", price: null, period: "ANNUAL" }),
    ]);
    expect(out).toContain("Mensuel A");
    expect(out).not.toContain("Annuel B");
    expect(out).toContain("Devis C");
  });

  it("plan mis en avant : badge Le plus choisi", () => {
    expect(html([plan({ highlighted: true })])).toContain("Le plus choisi");
    expect(html([plan()])).not.toContain("Le plus choisi");
  });

  it("libellés de fonctionnalités rendus en texte (échappés)", () => {
    const out = renderToStaticMarkup(<PricingGrid plans={[plan({ features: ["<b>x</b>"], name: "<i>N</i>" })]} />);
    expect(out).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(out).not.toContain("<b>x</b>");
    expect(out).toContain("&lt;i&gt;N&lt;/i&gt;");
  });

  it("aucun plan : Tarifs sur demande et lien contact", () => {
    const out = html([]);
    expect(out).toContain("Tarifs sur demande");
    expect(out).toContain('href="/contact"');
  });
});
