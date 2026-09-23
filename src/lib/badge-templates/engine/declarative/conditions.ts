import type {
  Condition,
  ConditionRef,
  NamedCondition,
  VariableValues,
  VisibleIf,
} from "./manifest-types";
import { resolveVariable, type VariableIndex } from "./variables";

export type ConditionIndex = Record<string, Condition | Condition[]>;

export function indexConditions(conditions: NamedCondition[] = []): ConditionIndex {
  const index: ConditionIndex = {};
  for (const condition of conditions) index[condition.name] = condition.when;
  return index;
}

function isRef(entry: Condition | ConditionRef): entry is ConditionRef {
  return "use" in entry;
}

function evaluate(index: VariableIndex, values: VariableValues, condition: Condition): boolean {
  const value = resolveVariable(index, values, condition.variable);
  if ("equals" in condition) return value === condition.equals;
  // Le vide d'une variable, quel que soit son type : chaine vide ou booleen faux.
  return (value === "" || value === false) === condition.isEmpty;
}

// Une entree est soit une condition litterale, soit une reference vers une
// condition nommee — laquelle porte a son tour une condition ou une conjonction.
function evaluateEntry(
  index: VariableIndex,
  values: VariableValues,
  conditions: ConditionIndex,
  entry: Condition | ConditionRef,
): boolean {
  if (!isRef(entry)) return evaluate(index, values, entry);
  const named = conditions[entry.use];
  // Le schema refuse une reference inconnue ; au rendu on masque plutot que de
  // lever, fidele au principe « aucune erreur a l'execution ».
  if (named === undefined) return false;
  const list = Array.isArray(named) ? named : [named];
  return list.every((condition) => evaluate(index, values, condition));
}

// Un bloc sans condition est toujours visible. Une liste de conditions se lit comme
// une conjonction : toutes doivent etre vraies.
export function isBlockVisible(
  index: VariableIndex,
  values: VariableValues,
  visibleIf?: VisibleIf,
  conditions: ConditionIndex = {},
): boolean {
  if (!visibleIf) return true;
  const entries = Array.isArray(visibleIf) ? visibleIf : [visibleIf];
  return entries.every((entry) => evaluateEntry(index, values, conditions, entry));
}
