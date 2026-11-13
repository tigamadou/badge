import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withOrgAuth } from "@/lib/with-org-auth";
import { actorContext, createRole, listRoles, parseBody, createRoleSchema, withRoleErrors } from "@/lib/role-management";

const querySchema = z.object({
  scope: z.enum(["ORG", "EVENT"]).default("ORG"),
  archived: z.enum(["true", "false"]).default("false"),
});

const postSchema = createRoleSchema.extend({ scope: z.enum(["ORG", "EVENT"]) });

// Rôles système communs puis rôles personnalisés de cette organisation uniquement.
export const GET = withOrgAuth("org.roles.manage", async (req, { orgId }) => {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const roles = await listRoles({ scope: parsed.data.scope, orgId }, { includeArchived: parsed.data.archived === "true" });
  return NextResponse.json({ roles });
});

export const POST = withOrgAuth("org.roles.manage", (req, { orgId, session }) =>
  withRoleErrors(async () => {
    const body = await parseBody(req, postSchema);
    if (!body.ok) return body.res;
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!org) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const actor = await actorContext(session.user.id);
    const { scope, ...input } = body.data;
    const role = await createRole(actor, { scope, orgId }, input, req);
    return NextResponse.json({ role }, { status: 201 });
  }),
);
