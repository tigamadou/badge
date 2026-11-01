import { z } from "zod";

// Créneau de présence sur place : date AAAA-MM-JJ, horaires HH:MM (début strictement avant la fin).
export const onsiteSlotSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    from: z.string().regex(/^\d{2}:\d{2}$/),
    to: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .refine((slot) => slot.from < slot.to, { message: "L'heure de début doit précéder l'heure de fin" });

export type OnsiteSlot = z.infer<typeof onsiteSlotSchema>;

const isoDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Date invalide",
});

// Modification partielle des informations d'une demande : tous les champs sont facultatifs.
export const detailsPatchSchema = z.object({
  delivery: z.enum(["PICKUP", "DELIVERY"]).optional(),
  deliveryAddress: z.string().max(500).optional(),
  deliveryContactName: z.string().max(120).optional(),
  deliveryContactPhone: z.string().max(40).optional(),
  wantedBy: isoDate.nullable().optional(),
  estimatedQuantity: z.number().int().min(1).max(100_000).optional(),
  onsiteSchedule: z.array(onsiteSlotSchema).min(1).max(30).optional(),
  onsiteLocation: z.string().max(500).optional(),
  onsiteContactName: z.string().max(120).optional(),
  onsiteContactPhone: z.string().max(40).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export type DetailsPatch = z.infer<typeof detailsPatchSchema>;

export const badgeSelectionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("ALL_AVAILABLE") }),
  z.object({ mode: z.literal("CATEGORIES"), categoryIds: z.array(z.string()).min(1) }),
  z.object({ mode: z.literal("IDS"), registrationIds: z.array(z.string()).min(1) }),
]);

export type BadgeSelection = z.infer<typeof badgeSelectionSchema>;
