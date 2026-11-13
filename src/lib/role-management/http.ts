import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadUserContext } from "@/lib/user-context";
import type { UserContext } from "@/types/auth";
import { roleErrorResponse } from "./errors";

const name = z.string().trim().min(2).max(60);
const description = z.string().trim().max(500).nullable();
const permissions = z.array(z.string().max(100)).max(200);

export const createRoleSchema = z.object({ name, description: description.optional(), permissions }).strict();
export const updateRoleSchema = z
  .object({ name: name.optional(), description: description.optional(), permissions: permissions.optional() })
  .strict();
export const overridesSchema = z
  .array(z.object({ permission: z.string().max(100), effect: z.enum(["GRANT", "REVOKE"]) }).strict())
  .max(400);

export type Parsed<T> = { ok: true; data: T } | { ok: false; res: NextResponse };

export async function parseBody<S extends z.ZodType>(req: NextRequest, schema: S): Promise<Parsed<z.infer<S>>> {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, res: NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 }) };
  }
  return { ok: true, data: parsed.data };
}

/** Contexte de l'acteur (la garde de la route a déjà vérifié que le compte existe et n'est pas archivé). */
export async function actorContext(userId: string): Promise<UserContext> {
  return (await loadUserContext(userId))!;
}

/** Exécute `fn` et traduit les `RoleError` en réponse HTTP ; toute autre erreur est relancée. */
export async function withRoleErrors(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    const res = roleErrorResponse(err);
    if (res) return res;
    throw err;
  }
}
