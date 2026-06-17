import { z } from "zod";

export const ID_DOC_TYPES = [
  "CNI",
  "Passeport",
  "Permis de conduire",
  "Carte de séjour",
] as const;

const baseFields = {
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Email invalide")),
  firstName: z.string().trim().min(1, "Prénom requis").max(120),
  lastName: z.string().trim().min(1, "Nom requis").max(120),
  structure: z.string().trim().min(1, "Structure requise").max(200),
  categoryId: z.string().min(1, "Catégorie requise"),
  idDocumentType: z.enum(ID_DOC_TYPES, { message: "Type de pièce inconnu" }),
  idDocumentNumber: z.string().trim().min(1, "Numéro requis").max(60),
  recaptchaToken: z.string().optional().default(""),
};

export const publicRegistrationSchema = z.object({
  ...baseFields,
  photoToken: z.string().min(1, "Photo requise"),
  idDocumentToken: z.string().min(1, "Document requis"),
});

export const editRegistrationSchema = z.object({
  ...baseFields,
  photoToken: z.string().optional().default(""),
  idDocumentToken: z.string().optional().default(""),
});

export type PublicRegistrationInput = z.infer<typeof publicRegistrationSchema>;
export type EditRegistrationInput = z.infer<typeof editRegistrationSchema>;
