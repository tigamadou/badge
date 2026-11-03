import { z } from "zod";

// Pas de .default() sur minQuantity : avec Zod 4, .partial() le reinjecterait
// et un PATCH { published: true } ecraserait la valeur stockee. Le 1 par defaut
// est applique par createProduct.
export const productCreateSchema = z.object({
  kind: z.enum(["BADGE", "ACCESSORY"]),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(60).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  basePrice: z.number().int().min(0).max(10_000_000),
  minQuantity: z.number().int().min(1).max(100_000).optional(),
  leadTimeDays: z.number().int().min(0).max(365).nullable().optional(),
});

export const productUpdateSchema = productCreateSchema
  .omit({ kind: true })
  .partial()
  .extend({
    published: z.boolean().optional(),
    position: z.number().int().min(0).max(10_000).optional(),
  });

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

// Cles produites par POST /api/platform/upload?context=print-product.
export const PRODUCT_IMAGE_KEY = /^platform\/print-products\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

const imageKey = z.string().regex(PRODUCT_IMAGE_KEY);

export const imageInputSchema = z.object({
  storageKey: imageKey,
  alt: z.string().max(200),
});

export const imagesInputSchema = z
  .object({ images: z.array(imageInputSchema).max(10) })
  .superRefine((v, ctx) => {
    const keys = v.images.map((i) => i.storageKey);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({ code: "custom", path: ["images"], message: "Images en double" });
    }
  });

export const tierInputSchema = z.object({
  minQuantity: z.number().int().min(2).max(1_000_000),
  unitPrice: z.number().int().min(0).max(10_000_000),
});

export const tiersInputSchema = z
  .object({ tiers: z.array(tierInputSchema).max(20) })
  .superRefine((v, ctx) => {
    const qs = v.tiers.map((t) => t.minQuantity);
    if (new Set(qs).size !== qs.length) {
      ctx.addIssue({ code: "custom", path: ["tiers"], message: "Quantités minimales en double" });
    }
  });

export const optionValueInputSchema = z.object({
  id: z.string().min(1).optional(),
  label: z.string().trim().min(1).max(80),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
  imageKey: imageKey.nullable(),
  priceDelta: z.number().int().min(0).max(1_000_000),
});

export const optionInputSchema = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().trim().min(1).max(80),
    help: z.string().max(300).nullable(),
    type: z.enum(["CHOICE", "MULTI_CHOICE", "COLOR", "QUANTITY_SPLIT", "TEXT", "FILE"]),
    required: z.boolean(),
    priceDelta: z.number().int().min(0).max(1_000_000),
    maxLength: z.number().int().min(1).max(200).nullable(),
    values: z.array(optionValueInputSchema).max(50),
  })
  .superRefine((o, ctx) => {
    const fail = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    const withValues = o.type === "CHOICE" || o.type === "MULTI_CHOICE" || o.type === "COLOR" || o.type === "QUANTITY_SPLIT";
    if (withValues) {
      if (o.values.length === 0) fail("values", "Au moins une valeur est requise");
      if (o.priceDelta !== 0) fail("priceDelta", "Le supplément se définit sur les valeurs");
    } else if (o.values.length > 0) {
      fail("values", "Ce type d'option n'a pas de valeur");
    }
    if (o.type === "COLOR" && o.values.some((v) => v.colorHex === null)) {
      fail("values", "Chaque couleur exige un code hexadécimal");
    }
    if (o.type === "TEXT" && o.maxLength === null) fail("maxLength", "La longueur maximale est requise");
    const ids = o.values.flatMap((v) => (v.id ? [v.id] : []));
    if (new Set(ids).size !== ids.length) fail("values", "Identifiants de valeur en double");
  });

export const optionsInputSchema = z
  .object({ options: z.array(optionInputSchema).max(30) })
  .superRefine((v, ctx) => {
    const ids = v.options.flatMap((o) => (o.id ? [o.id] : []));
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Identifiants d'option en double" });
    }
  });

export type ImageInput = z.infer<typeof imageInputSchema>;
export type TierInput = z.infer<typeof tierInputSchema>;
export type OptionValueInput = z.infer<typeof optionValueInputSchema>;
export type OptionInput = z.infer<typeof optionInputSchema>;
