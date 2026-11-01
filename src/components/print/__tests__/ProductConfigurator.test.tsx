import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductConfigurator, nextColorChoice } from "../ProductConfigurator";
import { ProductGallery } from "../ProductGallery";
import { CORDON, v } from "@/lib/__tests__/helpers/print-products";
import { choiceErrorMessage, formatFcfa, type CatalogProduct, type PricingOption } from "@/lib/print-catalog/pricing-core";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");
const noop = () => {};

const opt = (o: Partial<PricingOption> & Pick<PricingOption, "id" | "type">): PricingOption => ({
  name: o.id, help: null, required: false, priceDelta: 0, maxLength: null, archived: false, values: [], ...o,
});
const withOptions = (options: PricingOption[]): CatalogProduct => ({
  ...CORDON, description: null, options,
});

describe("ProductConfigurator", () => {
  it("affiche les prix unitaire et total estimes", () => {
    const html = renderToStaticMarkup(
      <ProductConfigurator
        product={{ ...CORDON, description: "Premier paragraphe.\n\nSecond paragraphe." }}
        value={{ quantity: 100, choices: [
          { optionId: "o-color", valueIds: ["or"] }, { optionId: "o-text", text: "Forum 2026" },
        ] }}
        onChange={noop}
      />,
    );
    expect(html).toContain(formatFcfa(700));
    expect(html).toContain(formatFcfa(70000));
    expect(html).toContain("Prix unitaire estimé");
    expect(html).toContain("Total estimé");
    expect(html).toContain(esc("Estimation : le prix définitif est fixé dans le devis."));
    expect(html).toContain("10/30");
    expect(html).toContain("Premier paragraphe.");
    expect(html).toContain("Second paragraphe.");
    expect(html).toContain('aria-label="Or (+100 FCFA)"');
    expect(html).toContain('role="group"');
    expect(html).toContain("aria-labelledby=");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('min="50"');
    expect(html).not.toContain("readOnly");
  });

  it("quantite sous le minimum : message sous la quantite, pas de prix", () => {
    const html = renderToStaticMarkup(
      <ProductConfigurator
        product={CORDON}
        value={{ quantity: 49, choices: [{ optionId: "o-color", valueIds: ["rouge"] }] }}
        onChange={noop}
        quantityLocked
      />,
    );
    expect(html).toContain(esc(choiceErrorMessage("QUANTITY_BELOW_MINIMUM")));
    expect(html).toContain("readOnly");
    expect(html).not.toContain("Total estimé");
  });

  it("option obligatoire manquante : message rouge sous l'option", () => {
    const html = renderToStaticMarkup(
      <ProductConfigurator product={CORDON} value={{ quantity: 100, choices: [] }} onChange={noop} />,
    );
    expect(html).toContain(esc(choiceErrorMessage("REQUIRED_OPTION_MISSING")));
    expect(html).toContain(formatFcfa(450));
    expect(html).toContain(formatFcfa(45000));
    expect(html).toContain("Estimation partielle : options obligatoires manquantes.");
  });

  it("COLOR : la pastille choisie se desélectionne seulement si l'option est facultative", () => {
    const color = opt({ id: "c", type: "COLOR", values: [v("a", "Rouge", "#f00", 0)] });
    expect(nextColorChoice(color, ["a"], "a")).toBeNull();
    expect(nextColorChoice(color, [], "a")).toEqual({ optionId: "c", valueIds: ["a"] });
    expect(nextColorChoice({ ...color, required: true }, ["a"], "a")).toEqual({ optionId: "c", valueIds: ["a"] });
  });

  it("erreur sans option (produit indisponible) : sous la quantite", () => {
    const html = renderToStaticMarkup(
      <ProductConfigurator
        product={{ ...CORDON, archived: true }}
        value={{ quantity: 100, choices: [{ optionId: "o-color", valueIds: ["rouge"] }] }}
        onChange={noop}
      />,
    );
    expect(html).toContain(esc(choiceErrorMessage("PRODUCT_UNAVAILABLE")));
  });

  it("CHOICE : supplement affiche derriere les valeurs payantes", () => {
    const product = withOptions([
      opt({ id: "c", type: "CHOICE", name: "Finition", values: [v("a", "Mat", null, 0), v("b", "Brillant", null, 50)] }),
    ]);
    const html = renderToStaticMarkup(
      <ProductConfigurator product={product} value={{ quantity: 50, choices: [{ optionId: "c", valueIds: ["a"] }] }} onChange={noop} />,
    );
    expect(html).toContain("Brillant (+50 FCFA)");
    expect(html).toContain(">Mat<");
  });

  it("MULTI_CHOICE : cases a cocher", () => {
    const product = withOptions([
      opt({ id: "m", type: "MULTI_CHOICE", name: "Extras", values: [v("a", "Clip", null, 20), v("b", "Etui", null, 0)] }),
    ]);
    const html = renderToStaticMarkup(
      <ProductConfigurator product={product} value={{ quantity: 50, choices: [{ optionId: "m", valueIds: ["a"] }] }} onChange={noop} />,
    );
    expect(html).toContain('role="checkbox"');
    expect(html).toContain("Clip (+20 FCFA)");
  });

  it("FILE sans uploadFile : champ desactive et mention", () => {
    const product = withOptions([opt({ id: "f", type: "FILE", name: "Logo" })]);
    const html = renderToStaticMarkup(
      <ProductConfigurator product={product} value={{ quantity: 50, choices: [] }} onChange={noop} />,
    );
    expect(html).toContain(esc("Téléversement disponible dans la demande d'impression"));
    expect(html).not.toContain('type="file"');
  });

  it("FILE avec uploadFile : zone de depot, puis fichier joint", () => {
    const product = withOptions([opt({ id: "f", type: "FILE", name: "Logo" })]);
    const empty = renderToStaticMarkup(
      <ProductConfigurator product={product} value={{ quantity: 50, choices: [] }} onChange={noop}
        uploadFile={async () => "k"} />,
    );
    expect(empty).toContain('type="file"');
    const done = renderToStaticMarkup(
      <ProductConfigurator product={product} value={{ quantity: 50, choices: [{ optionId: "f", fileKey: "print-requests/staff/x.pdf" }] }}
        onChange={noop} uploadFile={async () => "k"} />,
    );
    expect(done).toContain("x.pdf");
    expect(done).not.toContain('type="file"');
  });

  it("QUANTITY_SPLIT : un champ par valeur et total reparti", () => {
    const product = withOptions([
      opt({ id: "s", type: "QUANTITY_SPLIT", name: "Tailles", values: [v("s", "S", null, 0), v("m", "M", null, 0)] }),
    ]);
    const html = renderToStaticMarkup(
      <ProductConfigurator product={product} value={{ quantity: 200, choices: [
        { optionId: "s", split: [{ valueId: "s", quantity: 120 }, { valueId: "m", quantity: 60 }] },
      ] }} onChange={noop} />,
    );
    expect(html).toContain("Réparti : 180 / 200");
    expect(html).toContain('value="120"');
    expect(html).toContain('value="60"');
  });

  it("QUANTITY_SPLIT sans repartition : valeurs vides et aide de l'option", () => {
    const product = withOptions([
      opt({ id: "s", type: "QUANTITY_SPLIT", name: "Tailles", help: "Repartissez.", values: [v("s", "S", null, 0)] }),
    ]);
    const html = renderToStaticMarkup(
      <ProductConfigurator product={product} value={{ quantity: 50, choices: [] }} onChange={noop} />,
    );
    expect(html).toContain("Réparti : 0 / 50");
    expect(html).toContain("Repartissez.");
  });
});

describe("ProductGallery", () => {
  it("image principale et vignettes", () => {
    const html = renderToStaticMarkup(
      <ProductGallery images={[{ storageKey: "a.jpg", alt: "A" }, { storageKey: "b.jpg", alt: "B" }]} />,
    );
    expect(html).toContain('src="/api/files/a.jpg"');
    expect(html).toContain('aria-label="Image 2"');
  });

  it("sans image : pictogramme ; une seule image : pas de vignettes", () => {
    expect(renderToStaticMarkup(<ProductGallery images={[]} />)).not.toContain("<img");
    expect(renderToStaticMarkup(<ProductGallery images={[{ storageKey: "a.jpg", alt: "A" }]} />)).not.toContain("<button");
  });
});
