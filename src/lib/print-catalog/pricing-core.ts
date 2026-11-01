// Calcul du prix estime d'un produit d'impression. Module pur, utilisable
// cote navigateur : aucun import de Prisma (les enums sont des unions de chaines).

export type PrintOptionTypeName =
  | "CHOICE" | "MULTI_CHOICE" | "COLOR" | "TEXT" | "FILE" | "QUANTITY_SPLIT";

export type PricingValue = {
  id: string; label: string; colorHex: string | null; imageKey: string | null;
  priceDelta: number; archived: boolean;
};

export type PricingOption = {
  id: string; name: string; help: string | null; type: PrintOptionTypeName;
  required: boolean; priceDelta: number; maxLength: number | null; archived: boolean;
  values: PricingValue[];
};

export type ProductForPricing = {
  id: string; kind: "BADGE" | "ACCESSORY"; name: string; basePrice: number;
  minQuantity: number; published: boolean; archived: boolean;
  priceTiers: { minQuantity: number; unitPrice: number }[];
  options: PricingOption[];
};

// Forme renvoyee par la vitrine et passee aux composants.
export type CatalogProduct = ProductForPricing & {
  slug: string; category: string | null; description: string | null;
  leadTimeDays: number | null; images: { storageKey: string; alt: string }[];
};

export type OptionChoice = {
  optionId: string; valueIds?: string[]; text?: string; fileKey?: string;
  split?: { valueId: string; quantity: number }[];
};

type PricedBase = Pick<ProductForPricing, "basePrice" | "priceTiers">;

// Prix unitaire du palier au minQuantity le plus haut <= quantity, sinon le prix de base.
export function tierPriceFor(product: PricedBase, quantity: number): number {
  let bestMin = -1;
  let price = product.basePrice;
  for (const tier of product.priceTiers) {
    if (tier.minQuantity <= quantity && tier.minQuantity > bestMin) {
      bestMin = tier.minQuantity;
      price = tier.unitPrice;
    }
  }
  return price;
}

// Prix « a partir de » : le plus bas entre la base et les paliers.
export function startingPrice(product: PricedBase): number {
  return Math.min(product.basePrice, ...product.priceTiers.map((t) => t.unitPrice));
}

// Supplement par unite d'une option. Ne valide rien : ignore l'inconnu.
function optionSupplement(option: PricingOption, choice: OptionChoice, quantity: number): number {
  const valueDelta = (id: string) => option.values.find((val) => val.id === id)?.priceDelta ?? 0;
  switch (option.type) {
    case "CHOICE":
    case "COLOR":
    case "MULTI_CHOICE":
      return (choice.valueIds ?? []).reduce((sum, id) => sum + valueDelta(id), 0);
    case "TEXT":
      return choice.text?.trim() ? option.priceDelta : 0;
    case "FILE":
      return choice.fileKey ? option.priceDelta : 0;
    default: {
      // QUANTITY_SPLIT (dernier cas : evite une branche implicite non couvrable).
      // Quantite vide ou negative (configurateur en cours de saisie) : pas de supplement.
      if (quantity <= 0) return 0;
      const total = (choice.split ?? []).reduce((sum, part) => sum + valueDelta(part.valueId) * part.quantity, 0);
      return Math.round(total / quantity);
    }
  }
}

// Prix unitaire estime : palier + suppléments. Appeler validateChoices avant.
export function unitPriceFor(product: ProductForPricing, quantity: number, choices: OptionChoice[]): number {
  let price = tierPriceFor(product, quantity);
  for (const choice of choices) {
    const option = product.options.find((o) => o.id === choice.optionId);
    if (option) price += optionSupplement(option, choice, quantity);
  }
  return price;
}

// « 70 000 FCFA » : separateur de milliers = espace fine insecable (U+202F).
export function formatFcfa(amount: number): string {
  return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;
}
