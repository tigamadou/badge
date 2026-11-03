import { prisma } from "@/lib/prisma";

const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type CordonOverrides = Partial<{ published: boolean; archived: boolean; name: string }>;

// Equivalent en base de CORDON (helpers/print-products.ts) : 500 FCFA, paliers 100:450 et
// 500:400, couleur (Or +100) et texte imprime (+150), 4 images.
export async function createCordonInDb(overrides: CordonOverrides = {}): Promise<{
  productId: string;
  optionIds: { color: string; text: string };
  valueIds: Record<"rouge" | "bleu" | "noir" | "blanc" | "or", string>;
}> {
  const name = overrides.name ?? uniq("Cordon tour de cou 20 mm");
  const product = await prisma.printProduct.create({
    data: {
      kind: "ACCESSORY",
      name,
      slug: uniq("cordon"),
      category: "Cordons",
      basePrice: 500,
      minQuantity: 50,
      leadTimeDays: 7,
      published: overrides.published ?? true,
      archived: overrides.archived ?? false,
      archivedAt: overrides.archived ? new Date() : null,
      images: {
        create: [0, 1, 2, 3].map((i) => ({
          storageKey: `platform/print-products/${uniq("img")}.jpg`, alt: `Cordon ${i}`, position: i,
        })),
      },
      priceTiers: {
        create: [
          { minQuantity: 100, unitPrice: 450 },
          { minQuantity: 500, unitPrice: 400 },
        ],
      },
    },
  });
  const color = await prisma.printProductOption.create({
    data: { productId: product.id, name: "Couleur", type: "COLOR", required: true, position: 0 },
  });
  const text = await prisma.printProductOption.create({
    data: {
      productId: product.id, name: "Texte imprimé", type: "TEXT", priceDelta: 150, maxLength: 30, position: 1,
    },
  });
  const defs = [
    ["rouge", "Rouge", "#D32F2F", 0],
    ["bleu", "Bleu", "#1976D2", 0],
    ["noir", "Noir", "#000000", 0],
    ["blanc", "Blanc", "#FFFFFF", 0],
    ["or", "Or", "#C9A227", 100],
  ] as const;
  const valueIds = {} as Record<"rouge" | "bleu" | "noir" | "blanc" | "or", string>;
  for (let i = 0; i < defs.length; i++) {
    const [key, label, colorHex, priceDelta] = defs[i];
    const row = await prisma.printProductOptionValue.create({
      data: { optionId: color.id, label, colorHex, priceDelta, position: i },
    });
    valueIds[key] = row.id;
  }
  return { productId: product.id, optionIds: { color: color.id, text: text.id }, valueIds };
}
