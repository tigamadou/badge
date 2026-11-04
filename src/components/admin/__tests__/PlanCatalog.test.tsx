import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlanCatalog, type CatalogPlan, type QuoteView } from "../PlanCatalog";

// Pas de DOM en test (environnement node) : rendu statique ; les interactions sont couvertes en e2e.
const norm = (s: string) => s.replace(/[\u202f\u00a0]/g, " ").replace(/&#x27;/g, "'").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const pro: CatalogPlan = { id: "pro", name: "Pro", period: "MONTHLY", price: 30000, maxEvents: 10, maxParticipantsPerEvent: null };
const dear: CatalogPlan = { id: "dear", name: "Business", period: "MONTHLY", price: 45000, maxEvents: null, maxParticipantsPerEvent: 100 };
const cheap: CatalogPlan = { id: "cheap", name: "Basic", period: "MONTHLY", price: 10000, maxEvents: 1, maxParticipantsPerEvent: 1 };

function html(quotes: Record<string, QuoteView>, over: Partial<Parameters<typeof PlanCatalog>[0]> = {}) {
  return renderToStaticMarkup(
    <PlanCatalog
      orgId="o1"
      plans={[pro, dear, cheap]}
      quotes={quotes}
      currentPlanId="pro"
      scheduledPlanId={null}
      canPay
      {...over}
    />,
  );
}
const text = (quotes: Record<string, QuoteView>, over: Partial<Parameters<typeof PlanCatalog>[0]> = {}) =>
  norm(html(quotes, over));

// Bouton « label » : désactivé ou non.
function button(markup: string, label: string): { found: boolean; disabled: boolean } {
  const m = markup.match(new RegExp(`<button([^>]*)>(?:(?!</button>).)*${label}(?:(?!</button>).)*</button>`));
  return { found: Boolean(m), disabled: Boolean(m && /\sdisabled(=|\s|$)/.test(m[1])) };
}

describe("PlanCatalog", () => {
  it("plan courant bloqué : bouton désactivé et date de renouvellement", () => {
    const q = { pro: { allowed: false, activeUntil: "2026-12-12T00:00:00.000Z", renewableFrom: "2026-12-05T00:00:00.000Z" } } as const;
    expect(text(q)).toContain("Votre abonnement est actif jusqu'au 12/12/2026, renouvelable à partir du 05/12/2026.");
    expect(button(html(q), "Renouveler")).toEqual({ found: true, disabled: true });
  });

  it("abonnement sans échéance", () => {
    expect(text({ pro: { allowed: false, activeUntil: null, renewableFrom: null } })).toContain(
      "Votre abonnement est actif sans échéance.",
    );
  });

  it("montée en gamme : prix plein, crédit et jours restants", () => {
    const q: Record<string, QuoteView> = {
      dear: { allowed: true, mode: "IMMEDIATE", listPrice: 45000, credit: 20000, amount: 25000, daysLeft: 12 },
    };
    expect(text(q)).toContain("Prix plein 45 000 FCFA − crédit 20 000 FCFA (12 jours restants) = 25 000 FCFA à payer");
    expect(button(html(q), "Passer à ce plan").disabled).toBe(false);
    expect(text(q)).toContain("Le montant exact est figé à la création du paiement.");
  });

  it("crédit couvrant le plan : message clair et bouton désactivé", () => {
    const q: Record<string, QuoteView> = {
      dear: { allowed: true, mode: "IMMEDIATE", listPrice: 45000, credit: 45000, amount: 0, daysLeft: 20 },
    };
    expect(text(q)).toContain("Votre crédit couvre déjà ce plan — contactez le support.");
    expect(text(q)).not.toContain("à payer");
    expect(button(html(q), "Passer à ce plan")).toEqual({ found: true, disabled: true });
  });

  it("un seul jour restant : singulier ; sans échéance : pas de jours", () => {
    const one: Record<string, QuoteView> = {
      dear: { allowed: true, mode: "IMMEDIATE", listPrice: 45000, credit: 100, amount: 44900, daysLeft: 1 },
    };
    expect(text(one)).toContain("(1 jour restant)");
    const none: Record<string, QuoteView> = {
      dear: { allowed: true, mode: "IMMEDIATE", listPrice: 45000, credit: 100, amount: 44900, daysLeft: null },
    };
    expect(text(none)).not.toContain("restant");
  });

  it("moins cher : programmation sans crédit", () => {
    const q: Record<string, QuoteView> = {
      cheap: { allowed: true, mode: "SCHEDULED", listPrice: 10000, credit: 0, amount: 10000, daysLeft: null },
    };
    expect(button(html(q), "Programmer").found).toBe(true);
    expect(text(q)).not.toContain("crédit");
    expect(text(q)).not.toContain("figé");
  });

  it("renouvellement en fenêtre : bouton Renouveler actif", () => {
    const q: Record<string, QuoteView> = {
      pro: { allowed: true, mode: "EXTENSION", listPrice: 30000, credit: 0, amount: 30000, daysLeft: null },
    };
    expect(button(html(q), "Renouveler")).toEqual({ found: true, disabled: false });
  });

  it("badges Plan actuel et Programmé, limites illimitées", () => {
    const t = text({}, { scheduledPlanId: "cheap" });
    expect(t).toContain("Plan actuel");
    expect(t).toContain("Programmé");
    expect(t).toContain("illimité événement(s)");
  });

  it("lecture seule : pas de bouton et message propriétaire", () => {
    const markup = html({}, { canPay: false });
    expect(markup).not.toContain("<button");
    expect(norm(markup)).toContain("Seul le propriétaire");
  });

  it("catalogue vide et libellé annuel", () => {
    expect(text({}, { plans: [] })).toContain("Aucun plan disponible à la vente.");
    expect(text({}, { plans: [{ ...pro, period: "ANNUAL" }] })).toContain("/ an");
  });
});
