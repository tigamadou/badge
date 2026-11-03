import type { CatalogProduct, PricingValue } from "@/lib/print-catalog/pricing-core";

// Fabrique une valeur d'option non archivee, sans image.
export function v(id: string, label: string, colorHex: string | null, priceDelta: number): PricingValue {
  return { id, label, colorHex, imageKey: null, priceDelta, archived: false };
}

// Jeu de test commun : cordon tour de cou (paliers, couleur, texte imprime).
export const CORDON: CatalogProduct = {
  id: "p1",
  kind: "ACCESSORY",
  name: "Cordon tour de cou 20 mm",
  slug: "cordon-tour-de-cou-20-mm",
  category: "Cordons",
  description: null,
  leadTimeDays: 7,
  basePrice: 500,
  minQuantity: 50,
  published: true,
  archived: false,
  images: [{ storageKey: "platform/print-products/a.jpg", alt: "Cordon rouge" }],
  priceTiers: [
    { minQuantity: 100, unitPrice: 450 },
    { minQuantity: 500, unitPrice: 400 },
  ],
  options: [
    {
      id: "o-color", name: "Couleur", help: null, type: "COLOR", required: true, priceDelta: 0,
      maxLength: null, archived: false,
      values: [
        v("rouge", "Rouge", "#D32F2F", 0),
        v("bleu", "Bleu", "#1976D2", 0),
        v("noir", "Noir", "#000000", 0),
        v("blanc", "Blanc", "#FFFFFF", 0),
        v("or", "Or", "#C9A227", 100),
      ],
    },
    {
      id: "o-text", name: "Texte imprimé", help: null, type: "TEXT", required: false,
      priceDelta: 150, maxLength: 30, archived: false, values: [],
    },
  ],
};
