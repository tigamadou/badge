import type { ProductConfiguration } from "@/components/print/ProductConfigurator";
import type { CatalogProduct } from "@/lib/print-catalog/pricing-core";

// Spec 39 (révisée) : la quantité d'un accessoire est plafonnée au nombre de badges de la commande.
// Elle vaut ce nombre par défaut, peut être baissée, jamais dépassée. Le serveur fait foi.

/** Saisie ramenée au plafond ; une saisie vide (NaN) reste vide. */
export function capQuantity(quantity: number, badgeCount: number): number {
  return Number.isNaN(quantity) ? quantity : Math.min(quantity, badgeCount);
}

export function capConfiguration(cfg: ProductConfiguration, badgeCount: number): ProductConfiguration {
  return { ...cfg, quantity: capQuantity(cfg.quantity, badgeCount) };
}

/** Nouvelle quantité quand le nombre de badges passe de `previous` à `next` (même règle que `followBadgeCount`). */
export function followedQuantity(quantity: number, previous: number, next: number): number {
  if (Number.isNaN(quantity)) return quantity;
  if (quantity === previous || quantity > next) return next;
  return quantity;
}

/** Un accessoire dont le minimum de commande dépasse le nombre de badges ne peut pas être choisi. */
export function accessoryBlockedReason(product: Pick<CatalogProduct, "minQuantity">, badgeCount: number): string | null {
  return product.minQuantity > badgeCount
    ? `Minimum de ${product.minQuantity}, supérieur au nombre de badges (${badgeCount})`
    : null;
}

/** Message d'alerte quand la quantité est inférieure au nombre de badges (l'enregistrement reste possible). */
export function belowBadgeCountWarning(quantity: number, badgeCount: number): string | null {
  return !Number.isNaN(quantity) && quantity < badgeCount
    ? `Quantité inférieure au nombre de badges de la commande (${badgeCount}).`
    : null;
}
