import type { TemplateContext } from "../types";
import type { Condition, VisibleIf } from "./manifest-types";
import { resolveSource } from "./resolve-source";

function evaluate(ctx: TemplateContext, condition: Condition): boolean {
  const value = resolveSource(ctx, condition.path);
  if ("equals" in condition) return value === condition.equals;
  return (value === "" || value === false) === condition.isEmpty;
}

// Un bloc sans condition est toujours visible. Une liste de conditions se lit comme
// une conjonction : toutes doivent etre vraies.
export function isBlockVisible(ctx: TemplateContext, visibleIf?: VisibleIf): boolean {
  if (!visibleIf) return true;
  const conditions = Array.isArray(visibleIf) ? visibleIf : [visibleIf];
  return conditions.every((condition) => evaluate(ctx, condition));
}
