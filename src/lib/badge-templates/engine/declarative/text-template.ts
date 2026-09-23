import type { VariableValues } from "./manifest-types";
import { resolveVariable, type VariableIndex } from "./variables";

// Un gabarit melange litteraux et references : « #{document.numero} » ou
// « {destinataire.prenom} {destinataire.nom} ». Le saut de ligne s'ecrit \n.
// Le motif suit la grammaire des noms de variables : segments alphanumeriques
// separes par des points, le premier caractere de chaque segment en minuscule.
// Un nom plat (« {mention} ») est admis depuis le format v2.
const PLACEHOLDER = /\{([a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)*)\}/g;

// Variables referencees par un gabarit. La validation s'en sert pour verifier que
// chacune est declaree par le manifeste.
export function extractVariables(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((m) => m[1]);
}

export function renderTextTemplate(
  template: string,
  index: VariableIndex,
  values: VariableValues,
): string {
  return template.replace(PLACEHOLDER, (_, name: string) =>
    String(resolveVariable(index, values, name)),
  );
}
