import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OrgPrintCreditCard } from "../OrgPrintCreditCard";
import { RelatedRequestLinks } from "../RelatedRequestLinks";

// Séparateur de milliers de formatFcfa : espace fine insécable (fr-FR).
const n = (s: string) => s.replace(/(\d) (?=\d{3})/g, "$1\u202f");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");

describe("OrgPrintCreditCard", () => {
  it("solde et mouvements EARNED / SPENT", () => {
    const html = renderToStaticMarkup(
      <OrgPrintCreditCard
        balance={45000}
        movements={[
          { id: "m1", kind: "EARNED", amount: 45000, quantity: 30, request: { reference: "IMP-0001" } },
          { id: "m2", kind: "SPENT", amount: -45000, quantity: null, request: { reference: "IMP-0002" } },
        ]}
      />,
    );
    expect(html).toContain(esc(n("Crédit d'impression : 45 000 FCFA")));
    expect(html).toContain(n("+ 45 000 FCFA — 30 badges non utilisés — IMP-0001"));
    expect(html).toContain(n("− 45 000 FCFA — appliqué à IMP-0002"));
  });

  it("solde nul sans mouvement : rien n'est rendu", () => {
    expect(renderToStaticMarkup(<OrgPrintCreditCard balance={0} movements={[]} />)).toBe("");
  });

  it("solde nul avec historique : la carte reste visible", () => {
    const html = renderToStaticMarkup(
      <OrgPrintCreditCard
        balance={0}
        movements={[{ id: "m1", kind: "EARNED", amount: 100, quantity: 1, request: null }]}
      />,
    );
    expect(html).toContain("0 FCFA");
    expect(html).toContain("+ 100 FCFA — 1 badge non utilisé");
  });
});

describe("RelatedRequestLinks", () => {
  const href = (id: string) => `/r/${id}`;
  it("rien sans parent ni complément", () => {
    expect(renderToStaticMarkup(<RelatedRequestLinks parent={null} supplements={[]} hrefOf={href} />)).toBe("");
  });
  it("parent et compléments", () => {
    const html = renderToStaticMarkup(
      <RelatedRequestLinks
        parent={{ id: "p", reference: "IMP-P" }}
        supplements={[{ id: "c", reference: "IMP-C" }]}
        hrefOf={href}
      />,
    );
    expect(html).toContain('href="/r/p"');
    expect(html).toContain("Complément de IMP-P");
    expect(html).toContain('href="/r/c"');
    expect(html).toContain("Demande complémentaire IMP-C");
  });
});
