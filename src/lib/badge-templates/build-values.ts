import type { Bindings } from "./bindings";
import type { TemplateContext } from "./types";
import type { VariableDeclaration, VariableValues } from "@tigamadou/pdf-engine";

// Table explicite plutot qu'un acces dynamique par split(".") : le compilateur
// verifie chaque acces, et une source retiree du contexte devient une erreur de
// typage au lieu d'un undefined a l'execution.
//
// Difference avec l'ancien resolve-source : on lit BRUT. `event.date` sort en Date
// et le formatage appartient au manifeste, via le `format` de la variable.
const READERS: Record<string, (c: TemplateContext) => string | boolean | Date> = {
  "participant.firstName": (c) => c.participant.firstName,
  "participant.lastName": (c) => c.participant.lastName,
  "participant.structure": (c) => c.participant.structure,
  "participant.photoDataUrl": (c) => c.participant.photoDataUrl,
  "category.name": (c) => c.category.name,
  "category.color": (c) => c.category.color,
  "category.neutralBadge": (c) => c.category.neutralBadge,
  "category.anonymous": (c) => c.category.anonymous,
  "event.title": (c) => c.event.title,
  "event.date": (c) => c.event.date,
  "event.location": (c) => c.event.location,
  "event.logoDataUrl": (c) => c.event.logoDataUrl ?? "",
  "badge.id": (c) => c.badge.id,
  "badge.verifyUrl": (c) => c.badge.verifyUrl,
  "badge.qrCodeDataUrl": (c) => c.badge.qrCodeDataUrl,
};

export function buildValues(
  ctx: TemplateContext,
  variables: VariableDeclaration[],
  bindings: Bindings,
): VariableValues {
  const values: VariableValues = {};

  for (const variable of variables) {
    // Object.hasOwn : une variable nommee `constructor` ne doit pas lire la
    // fonction heritee du prototype comme si c'etait une source.
    const source = Object.hasOwn(bindings, variable.name) ? bindings[variable.name] : undefined;
    // Absente ou nulle : on n'ecrit rien, et le moteur rendra le vide du type.
    if (!source) continue;

    const read = Object.hasOwn(READERS, source) ? READERS[source] : undefined;
    if (!read) throw new Error(`buildValues : source inconnue "${source}"`);

    const raw = read(ctx);
    values[variable.name] = raw instanceof Date ? raw.toISOString() : raw;
  }

  return values;
}
