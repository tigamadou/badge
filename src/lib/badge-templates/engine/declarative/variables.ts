import { formatDate } from "../format-date";
import type { AssetResolver } from "./fonts";
import type { VariableDeclaration, VariableValues } from "./manifest-types";

export type VariableIndex = Record<string, VariableDeclaration>;

export function indexVariables(variables: VariableDeclaration[]): VariableIndex {
  const index: VariableIndex = {};
  for (const variable of variables) index[variable.name] = variable;
  return index;
}

// Valeur de repli d'une variable absente : le rendu ne casse jamais en production,
// et un `visibleIf isEmpty` joue son role de bloc de repli.
function emptyOf(declaration: VariableDeclaration): string | boolean {
  return declaration.kind === "boolean" ? false : "";
}

export function resolveVariable(
  index: VariableIndex,
  values: VariableValues,
  name: string,
): string | boolean {
  const declaration = index[name];
  // Garde defensive : le schema refuse deja toute reference non declaree.
  if (!declaration) throw new Error(`resolveVariable : variable non declaree "${name}"`);

  const raw = values[name];
  if (raw === undefined || raw === "") return emptyOf(declaration);
  if (declaration.kind === "boolean") return Boolean(raw);

  if (declaration.kind === "date") {
    const date = new Date(String(raw));
    // Une date illisible vaut une absence : mieux vaut un bloc vide qu'un
    // « Invalid Date » imprime sur un document officiel.
    if (Number.isNaN(date.getTime())) return "";
    return formatDate(date, declaration.format);
  }

  return String(raw);
}

// Valeurs d'epreuve : les `sample` declares, les images resolues en data URL depuis
// les ressources du paquet. Une variable sans sample vaut son vide.
export function samplesOf(
  variables: VariableDeclaration[],
  assets: AssetResolver,
): VariableValues {
  const values: VariableValues = {};
  for (const variable of variables) {
    if (variable.sample === undefined) {
      values[variable.name] = emptyOf(variable);
      continue;
    }
    values[variable.name] =
      variable.kind === "image" ? assets(String(variable.sample)) : variable.sample;
  }
  return values;
}
