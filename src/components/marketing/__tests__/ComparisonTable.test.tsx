import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PublicPlan } from "@/lib/public-plans";
import { ComparisonTableView } from "../ComparisonTable";

const norm = (s: string) => s.replace(/[  ]/g, " ");

const plan = (over: Partial<PublicPlan>): PublicPlan => ({
  id: "p",
  name: "P",
  period: "MONTHLY",
  price: 15000,
  maxEvents: 10,
  maxParticipantsPerEvent: 500,
  description: null,
  features: [],
  highlighted: false,
  ...over,
});

describe("ComparisonTableView", () => {
  const plans = [
    plan({ id: "a", name: "Standard", features: ["Scanner mobile", "Badges PDF"] }),
    plan({ id: "b", name: "Pro", period: "ANNUAL", price: 150000, maxEvents: null, maxParticipantsPerEvent: null, features: ["Badges PDF", "Journal complet"] }),
    plan({ id: "c", name: "Sur mesure", price: null, features: [] }),
  ];
  const html = norm(renderToStaticMarkup(<ComparisonTableView plans={plans} />));

  it("une colonne par plan", () => {
    for (const name of ["Standard", "Pro", "Sur mesure"]) expect(html).toContain(`>${name}</th>`);
  });

  it("lignes de base : période, prix, événements, participants", () => {
    expect(html).toContain("Période");
    expect(html).toContain("Mensuel");
    expect(html).toContain("Annuel");
    expect(html).toContain("15 000 FCFA");
    expect(html).toContain("150 000 FCFA");
    expect(html).toContain("Sur devis");
    expect(html).toContain("Événements");
    expect(html).toContain("Participants / événement");
    expect(html).toContain("Illimité");
    expect(html).toContain("500");
  });

  it("union des fonctionnalités avec coche ou tiret", () => {
    for (const f of ["Scanner mobile", "Badges PDF", "Journal complet"]) expect(html).toContain(f);
    expect(html.match(/aria-label="Inclus"/g)).toHaveLength(4);
    expect(html.match(/aria-label="Non inclus"/g)).toHaveLength(5);
  });

  it("sans fonctionnalité : pas de section Fonctionnalités", () => {
    const out = renderToStaticMarkup(<ComparisonTableView plans={[plan({ id: "z" })]} />);
    expect(out).not.toContain("Fonctionnalités");
  });

  it("aucun plan : rien n'est rendu", () => {
    expect(renderToStaticMarkup(<ComparisonTableView plans={[]} />)).toBe("");
  });
});
