import { z } from "zod";
import type { VariableDeclaration, VariableKind } from "@tigamadou/pdf-engine";
import { BADGE_CONTRACT, reservedPrefixes } from "@tigamadou/pdf-engine/contracts";
import { OPTION_BINDING, type Bindings } from "./bindings";

// Options de template : variables hors contrat, reglees par evenement dans
// Event.templateOptions ({ nomDeVariable: valeur }). Memes bornes que le moteur.
export type OptionValue = boolean | string | string[];

export const MAX_TEMPLATE_OPTIONS = 50;
export const MAX_OPTION_CHARS = 500;
export const MAX_OPTION_ITEMS = 30;
const OPTION_NAME = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/;

export function readTemplateOptions(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export function optionVariables(variables: VariableDeclaration[], bindings: Bindings): VariableDeclaration[] {
  return variables.filter((variable) => bindings[variable.name] === OPTION_BINDING);
}

export function isValidOptionValue(kind: VariableKind, value: unknown): boolean {
  switch (kind) {
    case "boolean":
      return typeof value === "boolean";
    case "text":
      return typeof value === "string";
    case "color":
      return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
    case "date":
      return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
    case "list":
      return Array.isArray(value) && value.every((item) => typeof item === "string");
    case "image":
      return typeof value === "string" && value !== "";
  }
}

// Valeur a ecrire pour une option : la valeur reglee si elle a le bon type ; sinon
// le sample pour un booleen (un interrupteur a toujours un etat), rien ailleurs (un
// texte d'exemple imprime par defaut serait une erreur visible sur un vrai badge).
export function effectiveOption(
  variable: VariableDeclaration,
  stored: Record<string, unknown>,
): OptionValue | undefined {
  const value = Object.hasOwn(stored, variable.name) ? stored[variable.name] : undefined;
  if (value !== undefined && isValidOptionValue(variable.kind, value)) return value as OptionValue;
  if (variable.kind === "boolean") return variable.sample === true;
  return undefined;
}

const optionValueSchema = z.union([
  z.boolean(),
  z.string().max(MAX_OPTION_CHARS),
  z.array(z.string().max(MAX_OPTION_CHARS)).max(MAX_OPTION_ITEMS),
]);

export const templateOptionsSchema = z
  .record(z.string().max(60).regex(OPTION_NAME), optionValueSchema)
  .refine((value) => Object.keys(value).length <= MAX_TEMPLATE_OPTIONS)
  .refine((value) =>
    Object.keys(value).every((key) => !reservedPrefixes(BADGE_CONTRACT).some((p) => key.startsWith(p))),
  );

function isOptionValue(value: unknown): value is OptionValue {
  return optionValueSchema.safeParse(value).success;
}

// Le formulaire n'edite que les options du template courant : les valeurs reglees
// pour d'autres templates sont conservees. `null` retire une cle.
export function mergeTemplateOptions(
  stored: Record<string, unknown>,
  edited: Record<string, OptionValue | null>,
): Record<string, OptionValue> {
  const merged: Record<string, OptionValue> = {};
  for (const [key, value] of Object.entries(stored)) if (isOptionValue(value)) merged[key] = value;
  for (const [key, value] of Object.entries(edited)) {
    if (value === null) delete merged[key];
    else merged[key] = value;
  }
  return merged;
}

// Une option booleenne editee a sa valeur par defaut (sample === true, sinon faux)
// est retiree (null) : on ne fige pas dans l'evenement une valeur que le template
// pourra faire evoluer. Les autres types sont inchanges.
export function normalizeEditedOptions(
  options: Array<{ name: string; kind: VariableKind; sample?: unknown }>,
  edited: Record<string, OptionValue | null>,
): Record<string, OptionValue | null> {
  const out = { ...edited };
  for (const option of options) {
    if (option.kind === "boolean" && out[option.name] === (option.sample === true)) out[option.name] = null;
  }
  return out;
}
