import { Prisma } from "@prisma/client";
import { z } from "zod";

// Champs de la fiche publique d'un plan (page /tarifs), communs à la création et à la modification.
export const publicFieldsSchema = {
  publicVisible: z.boolean().optional(),
  position: z.number().int().min(0).max(9999).optional(),
  description: z.string().max(300).nullable().optional(),
  features: z.array(z.string().trim().min(1).max(120)).max(12).nullable().optional(),
  highlighted: z.boolean().optional(),
};

type PublicInput = {
  publicVisible?: boolean;
  position?: number;
  description?: string | null;
  features?: string[] | null;
  highlighted?: boolean;
};

// Ne retient que les champs présents (PATCH partiel). Une description vide devient null ;
// `features: null` efface la liste (NULL SQL, pas le JSON `null`).
export function publicFieldsData(input: PublicInput) {
  return {
    ...(input.publicVisible !== undefined && { publicVisible: input.publicVisible }),
    ...(input.position !== undefined && { position: input.position }),
    ...(input.description !== undefined && { description: input.description?.trim() || null }),
    ...(input.features !== undefined && { features: input.features ?? Prisma.DbNull }),
    ...(input.highlighted !== undefined && { highlighted: input.highlighted }),
  };
}

export function publicFieldsLog(plan: {
  publicVisible: boolean;
  position: number;
  description: string | null;
  features: Prisma.JsonValue;
  highlighted: boolean;
}) {
  return {
    publicVisible: plan.publicVisible,
    position: plan.position,
    description: plan.description,
    features: plan.features,
    highlighted: plan.highlighted,
  };
}
