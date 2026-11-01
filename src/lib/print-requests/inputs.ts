import { z } from "zod";
import type { OptionChoice } from "@/lib/print-catalog/pricing";

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

// AAAA-MM-JJ existant au calendrier (rejette 2026-02-30).
function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Créneau de présence sur place : date AAAA-MM-JJ, horaires HH:MM (début strictement avant la fin).
export const onsiteSlotSchema = z
  .object({
    date: z.string().refine(isCalendarDate, { message: "Date invalide" }),
    from: z.string().regex(HH_MM),
    to: z.string().regex(HH_MM),
  })
  .refine((slot) => slot.from < slot.to, { message: "L'heure de début doit précéder l'heure de fin" });

export type OnsiteSlot = z.infer<typeof onsiteSlotSchema>;

// AAAA-MM-JJ (minuit UTC) ou date-heure ISO complète avec décalage.
const isoDate = z.string().refine(
  (value) => isCalendarDate(value) || z.string().datetime({ offset: true }).safeParse(value).success,
  { message: "Date invalide" },
);

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

// Choix d'une option de produit : forme exacte de `OptionChoice` (plan 32).
export const optionChoiceSchema = z.object({
  optionId: z.string().min(1),
  valueIds: z.array(z.string()).max(50).optional(),
  text: z.string().max(2000).optional(),
  fileKey: z.string().max(300).optional(),
  split: z
    .array(z.object({ valueId: z.string(), quantity: z.number().int() }))
    .max(50)
    .optional(),
});

// Produits choisis par l'organisateur (un support BADGE et des accessoires). Une quantité nulle
// signifie « le nombre de badges ».
export const organizerProductsSchema = z
  .array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().min(1).max(1_000_000).nullable(),
      choices: z.array(optionChoiceSchema).max(50),
    }),
  )
  .max(30);

export type OrganizerProductInput = {
  productId: string;
  quantity: number | null;
  choices: OptionChoice[];
};

const LINE_KINDS = ["PRODUCT", "SERVICE", "DISCOUNT", "CUSTOM"] as const;

// Une remise est négative ou nulle ; toute autre ligne est positive ou nulle.
function signMatches(kind: (typeof LINE_KINDS)[number], unitPrice: number): boolean {
  return kind === "DISCOUNT" ? unitPrice <= 0 : unitPrice >= 0;
}

// Ligne de devis saisie par le staff.
export const staffLineSchema = z
  .object({
    kind: z.enum(LINE_KINDS),
    productId: z.string().min(1).nullable().optional(),
    label: z.string().trim().min(1).max(200),
    quantity: z.number().int().min(1).max(1_000_000),
    unitPrice: z.number().int().min(-10_000_000).max(10_000_000),
    choices: z.array(optionChoiceSchema).max(50).optional(),
  })
  .superRefine((line, ctx) => {
    if (!signMatches(line.kind, line.unitPrice)) {
      ctx.addIssue({ code: "custom", path: ["unitPrice"], message: "Signe du prix invalide" });
    }
    if (line.kind === "PRODUCT" && !line.productId) {
      ctx.addIssue({ code: "custom", path: ["productId"], message: "Produit requis" });
    }
  });

export type StaffLineInput = z.infer<typeof staffLineSchema>;

// Modification d'une ligne par le staff : au moins un champ.
export const staffLinePatchSchema = z
  .object({
    label: z.string().trim().min(1).max(200).optional(),
    quantity: z.number().int().min(1).max(1_000_000).optional(),
    unitPrice: z.number().int().min(-10_000_000).max(10_000_000).optional(),
  })
  .refine((patch) => Object.values(patch).some((v) => v !== undefined), {
    message: "Aucune modification",
  });

export type StaffLinePatch = z.infer<typeof staffLinePatchSchema>;
