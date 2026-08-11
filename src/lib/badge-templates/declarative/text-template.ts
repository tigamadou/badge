import type { TemplateContext } from "../types";
import { resolveSource } from "./resolve-source";

// Un gabarit de texte melange litteraux et references : « #{badge.id} » ou
// « {participant.firstName} {participant.lastName} ». Le saut de ligne s'ecrit \n.
const PLACEHOLDER = /\{([a-zA-Z]+\.[a-zA-Z]+)\}/g;

// Chemins references par un gabarit. Utilise par la validation pour verifier que
// chacun appartient a la liste blanche.
export function extractPaths(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((m) => m[1]);
}

export function renderTextTemplate(template: string, ctx: TemplateContext): string {
  return template.replace(PLACEHOLDER, (_, path: string) => String(resolveSource(ctx, path)));
}
