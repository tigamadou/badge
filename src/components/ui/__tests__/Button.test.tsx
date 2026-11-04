import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "../Button";

describe("Button", () => {
  it("rend le bouton sans état de chargement par défaut", () => {
    const html = renderToStaticMarkup(<Button>Valider</Button>);
    expect(html).not.toContain("aria-busy");
    expect(html).not.toContain("button-spinner");
    // L'attribut seul : les classes Tailwind contiennent « disabled:opacity-50 ».
    expect(html).not.toContain('disabled=""');
    expect(html).toContain(">Valider</button>");
  });

  it("affiche le spinner, désactive et marque aria-busy pendant le chargement", () => {
    const html = renderToStaticMarkup(<Button loading>Valider</Button>);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain("button-spinner");
  });

  it("garde le libellé pour la largeur et le nom accessible", () => {
    const html = renderToStaticMarkup(<Button loading>Valider</Button>);
    expect(html).toContain("Valider");
    expect(html).toContain("opacity-0");
    expect(html).not.toContain("invisible");
  });

  it("respecte disabled fourni par l'appelant hors chargement", () => {
    const html = renderToStaticMarkup(<Button disabled>Valider</Button>);
    expect(html).toContain('disabled=""');
    expect(html).not.toContain("aria-busy");
  });

  it("primary : marine, texte blanc, focus marine", () => {
    const html = renderToStaticMarkup(<Button>Enregistrer</Button>);
    for (const c of ["bg-navy", "text-white", "hover:bg-navy-hover", "focus-visible:ring-navy"]) {
      expect(html).toContain(c);
    }
    expect(html).not.toContain("green-");
  });

  it("positive : turquoise avec texte marine (jamais blanc)", () => {
    const html = renderToStaticMarkup(<Button variant="positive">Approuver</Button>);
    expect(html).toContain("bg-turquoise");
    expect(html).toContain("text-navy");
    expect(html).not.toMatch(/(?<!hover:)text-white/);
    expect(html).toContain("hover:bg-turquoise-strong");
    expect(html).toContain("px-4");
  });

  it("secondary : bordure slate-300, texte marine", () => {
    const html = renderToStaticMarkup(<Button variant="secondary">Annuler</Button>);
    for (const c of ["border", "border-slate-300", "text-navy", "hover:bg-mist"]) {
      expect(html).toContain(c);
    }
  });

  it("danger inchangé", () => {
    expect(renderToStaticMarkup(<Button variant="danger">Supprimer</Button>)).toContain("bg-rose-600");
  });

  it("la variante link n'a ni fond ni padding", () => {
    const html = renderToStaticMarkup(<Button variant="link">Archiver</Button>);
    expect(html).not.toContain("px-4");
    expect(html).not.toContain("bg-");
    expect(html).toContain("hover:underline");
  });
});
