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
