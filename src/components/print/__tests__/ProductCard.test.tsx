import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductCard } from "../ProductCard";
import { CORDON } from "@/lib/__tests__/helpers/print-products";

// renderToStaticMarkup echappe l'apostrophe (&#x27;) : on compare le texte echappe.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");

describe("ProductCard", () => {
  it("affiche nom, categorie, prix de depart, delai et image", () => {
    const html = renderToStaticMarkup(<ProductCard product={CORDON} />);
    expect(html).toContain(esc("Cordon tour de cou 20 mm"));
    expect(html).toContain("Cordons");
    expect(html).toContain("À partir de 400 FCFA");
    expect(html).toContain('src="/api/files/platform/print-products/a.jpg"');
    expect(html).toContain("Fabrication : 7 jours");
    expect(html).not.toContain("<button");
  });

  it("delai : 1 jour au singulier, 2 jours au pluriel", () => {
    const one = renderToStaticMarkup(<ProductCard product={{ ...CORDON, leadTimeDays: 1 }} />);
    expect(one).toContain("Fabrication : 1 jour<");
    const two = renderToStaticMarkup(<ProductCard product={{ ...CORDON, leadTimeDays: 2 }} />);
    expect(two).toContain("Fabrication : 2 jours");
  });

  it("sans image ni delai ni categorie : pictogramme seul", () => {
    const html = renderToStaticMarkup(
      <ProductCard product={{ ...CORDON, images: [], leadTimeDays: null, category: null }} />,
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("Fabrication");
    expect(html).toContain("<svg");
  });

  it("avec onSelect : bouton aria-pressed", () => {
    const on = renderToStaticMarkup(<ProductCard product={CORDON} selected onSelect={() => {}} />);
    expect(on).toContain("<button");
    expect(on).toContain('aria-pressed="true"');
    const off = renderToStaticMarkup(<ProductCard product={CORDON} onSelect={() => {}} />);
    expect(off).toContain('aria-pressed="false"');
  });
});
