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

export type ChoiceErrorCode =
  | "PRODUCT_UNAVAILABLE" | "QUANTITY_BELOW_MINIMUM" | "UNKNOWN_OPTION" | "OPTION_ARCHIVED"
  | "DUPLICATE_OPTION" | "REQUIRED_OPTION_MISSING" | "UNKNOWN_VALUE" | "VALUE_ARCHIVED"
  | "TOO_MANY_VALUES" | "TEXT_TOO_LONG" | "INVALID_FILE" | "SPLIT_MISMATCH";

export type ChoiceResult = { ok: true } | { ok: false; code: ChoiceErrorCode; optionId?: string };

const valueIdsOf = (choice: OptionChoice): string[] => choice.valueIds ?? [];
const splitOf = (choice: OptionChoice): NonNullable<OptionChoice["split"]> => choice.split ?? [];
const textOf = (choice: OptionChoice): string => choice.text ?? "";
const fileKeyOf = (choice: OptionChoice): string => choice.fileKey ?? "";

// Un choix est vide si le champ de son type est absent ou vide : il compte comme absent.
function isEmptyChoice(option: PricingOption, choice: OptionChoice): boolean {
  switch (option.type) {
    case "CHOICE":
    case "COLOR":
    case "MULTI_CHOICE":
      return valueIdsOf(choice).length === 0;
    case "TEXT":
      return !textOf(choice).trim();
    case "FILE":
      return !fileKeyOf(choice);
    default:
      return splitOf(choice).length === 0;
  }
}

const fail = (code: ChoiceErrorCode, optionId?: string): ChoiceResult => ({ ok: false, code, optionId });

// Controle d'un choix non vide ; renvoie le premier code d'echec ou null.
function checkChoiceContent(
  option: PricingOption, choice: OptionChoice, quantity: number,
): ChoiceErrorCode | null {
  const ids = option.type === "QUANTITY_SPLIT"
    ? splitOf(choice).map((part) => part.valueId)
    : valueIdsOf(choice);
  for (const id of ids) {
    const value = option.values.find((val) => val.id === id);
    if (!value) return "UNKNOWN_VALUE";
    if (value.archived) return "VALUE_ARCHIVED";
  }
  if (new Set(ids).size !== ids.length && option.type !== "QUANTITY_SPLIT") return "TOO_MANY_VALUES";
  switch (option.type) {
    case "CHOICE":
    case "COLOR":
      return ids.length > 1 ? "TOO_MANY_VALUES" : null;
    case "TEXT":
      return option.maxLength !== null && textOf(choice).length > option.maxLength ? "TEXT_TOO_LONG" : null;
    case "FILE":
      {
      const key = fileKeyOf(choice);
      const safe = key.startsWith("print-requests/") && !key.includes("..") && !key.includes("//");
      return safe ? null : "INVALID_FILE";
    }
    case "QUANTITY_SPLIT": {
      const parts = splitOf(choice);
      const valid = parts.every((part) => Number.isInteger(part.quantity) && part.quantity > 0)
        && new Set(ids).size === ids.length
        && parts.reduce((sum, part) => sum + part.quantity, 0) === quantity;
      return valid ? null : "SPLIT_MISMATCH";
    }
    default:
      return null;
  }
}

// Valide la configuration (premier echec renvoye). A appeler avant tout chiffrage.
export function validateChoices(
  product: ProductForPricing, choices: OptionChoice[], quantity: number,
): ChoiceResult {
  if (product.archived || !product.published) return fail("PRODUCT_UNAVAILABLE");
  if (!Number.isInteger(quantity) || quantity < product.minQuantity) return fail("QUANTITY_BELOW_MINIMUM");
  const seen = new Set<string>();
  const filled = new Set<string>();
  for (const choice of choices) {
    const option = product.options.find((o) => o.id === choice.optionId);
    if (!option) return fail("UNKNOWN_OPTION", choice.optionId);
    if (option.archived) return fail("OPTION_ARCHIVED", option.id);
    if (seen.has(option.id)) return fail("DUPLICATE_OPTION", option.id);
    seen.add(option.id);
    if (isEmptyChoice(option, choice)) continue;
    const code = checkChoiceContent(option, choice, quantity);
    if (code) return fail(code, option.id);
    filled.add(option.id);
  }
  const missing = product.options.find((o) => o.required && !o.archived && !filled.has(o.id));
  return missing ? fail("REQUIRED_OPTION_MISSING", missing.id) : { ok: true };
}

// Nettoie des choix enregistres (ex. ligne de commande rouverte) : retire ce qui
// reference une option ou une valeur absente/archivee depuis, et les choix devenus vides.
export function pruneChoices(
  product: CatalogProduct | ProductForPricing, choices: OptionChoice[],
): OptionChoice[] {
  const pruned: OptionChoice[] = [];
  for (const choice of choices) {
    const option = product.options.find((o) => o.id === choice.optionId);
    if (!option || option.archived) continue;
    const alive = (id: string) => option.values.some((val) => val.id === id && !val.archived);
    const next: OptionChoice = { ...choice };
    if (next.valueIds) next.valueIds = next.valueIds.filter(alive);
    if (next.split) next.split = next.split.filter((part) => alive(part.valueId));
    if (!isEmptyChoice(option, next)) pruned.push(next);
  }
  return pruned;
}

export type ChoiceSnapshot = {
  optionName: string; type: string; labels: string[]; text?: string; fileKey?: string;
  split?: { label: string; quantity: number }[]; priceDelta: number;
};

// Copie figee des choix : libelles et supplements au moment de la commande.
export function snapshotChoices(
  product: ProductForPricing, choices: OptionChoice[], quantity: number,
): ChoiceSnapshot[] {
  const snapshot: ChoiceSnapshot[] = [];
  for (const option of product.options) {
    const choice = choices.find((c) => c.optionId === option.id);
    if (!choice || isEmptyChoice(option, choice)) continue;
    const label = (id: string) => option.values.find((val) => val.id === id)?.label ?? id;
    const entry: ChoiceSnapshot = {
      optionName: option.name, type: option.type, labels: [],
      priceDelta: optionSupplement(option, choice, quantity),
    };
    if (option.type === "TEXT") entry.text = choice.text;
    else if (option.type === "FILE") entry.fileKey = choice.fileKey;
    else if (option.type === "QUANTITY_SPLIT") {
      entry.split = splitOf(choice).map((part) => ({ label: label(part.valueId), quantity: part.quantity }));
    } else entry.labels = valueIdsOf(choice).map(label);
    snapshot.push(entry);
  }
  return snapshot;
}

const CHOICE_MESSAGES: Record<ChoiceErrorCode, string> = {
  PRODUCT_UNAVAILABLE: "Ce produit n'est plus disponible.",
  QUANTITY_BELOW_MINIMUM: "La quantité est inférieure au minimum de commande.",
  UNKNOWN_OPTION: "Une option demandée n'existe pas pour ce produit.",
  OPTION_ARCHIVED: "Une option demandée n'est plus proposée.",
  DUPLICATE_OPTION: "Une option est renseignée plusieurs fois.",
  REQUIRED_OPTION_MISSING: "Choisissez une valeur pour chaque option obligatoire.",
  UNKNOWN_VALUE: "Une valeur choisie n'existe pas pour cette option.",
  VALUE_ARCHIVED: "Une valeur choisie n'est plus proposée.",
  TOO_MANY_VALUES: "Une seule valeur est autorisée pour cette option.",
  TEXT_TOO_LONG: "Le texte dépasse la longueur autorisée.",
  INVALID_FILE: "Le fichier joint n'est pas valide.",
  SPLIT_MISMATCH: "La répartition doit totaliser exactement la quantité commandée.",
};

export function choiceErrorMessage(code: ChoiceErrorCode): string {
  return CHOICE_MESSAGES[code];
}

// Configuration de depart du configurateur : quantite minimale, premiere valeur
// non archivee des options CHOICE/COLOR requises, rien d'autre.
export function defaultConfiguration(product: ProductForPricing): { quantity: number; choices: OptionChoice[] } {
  const choices: OptionChoice[] = [];
  for (const option of product.options) {
    if (option.archived || !option.required) continue;
    if (option.type !== "CHOICE" && option.type !== "COLOR") continue;
    const first = option.values.find((val) => !val.archived);
    if (first) choices.push({ optionId: option.id, valueIds: [first.id] });
  }
  return { quantity: product.minQuantity, choices };
}

// « 70 000 FCFA » : separateur de milliers = espace fine insecable (U+202F).
export function formatFcfa(amount: number): string {
  return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;
}
