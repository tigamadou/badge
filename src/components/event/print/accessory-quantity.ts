import type { ProductConfiguration } from "@/components/print/ProductConfigurator";

// Spec 39 : un accessoire est commandé à raison d'un par badge ; la quantité n'est jamais saisie.
export function withBadgeQuantity(cfg: ProductConfiguration, badgeCount: number): ProductConfiguration {
  return { ...cfg, quantity: badgeCount };
}
