// Liste blanche des chemins du TemplateContext exposes aux manifestes. Le `kind`
// permet de refuser un bloc qui consomme une source d'un type incompatible
// (ex. un bloc image pointant sur participant.firstName).
export type SourceKind = "text" | "color" | "image" | "boolean" | "date";

export const SOURCES: Record<string, SourceKind> = {
  "participant.firstName": "text",
  "participant.lastName": "text",
  "participant.structure": "text",
  "participant.photoDataUrl": "image",
  "category.name": "text",
  "category.color": "color",
  "category.neutralBadge": "boolean",
  "category.anonymous": "boolean",
  "event.title": "text",
  "event.date": "date",
  "event.location": "text",
  "event.logoDataUrl": "image",
  "badge.id": "text",
  "badge.verifyUrl": "text",
  "badge.qrCodeDataUrl": "image",
};

// Seuls chemins booleens admis dans un visibleIf : les deux notions metier.
export const CONDITION_PATHS = ["category.anonymous", "category.neutralBadge"] as const;
export type ConditionPath = (typeof CONDITION_PATHS)[number];
