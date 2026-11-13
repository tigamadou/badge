import { NextResponse } from "next/server";
import { z } from "zod";
import { withOrgAuth } from "@/lib/with-org-auth";
import {
  actorContext,
  applyOverrides,
  loadOrgLevel,
  overridesSchema,
  parseBody,
  withRoleErrors,
} from "@/lib/role-management";

const userIdOf = async (extra: unknown) => (await (extra as { params: Promise<{ userId: string }> }).params).userId;

const putSchema = z.object({ overrides: overridesSchema }).strict();

// Un seul niveau : l'organisation (les ajustements s'appliquent aussi à tous ses évènements).
export const GET = withOrgAuth("org.members.permissions.manage", async (_req, { orgId }, extra) => {
  const level = await loadOrgLevel(await userIdOf(extra), orgId);
  if (!level) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ levels: [level] });
});

export const PUT = withOrgAuth("org.members.permissions.manage", (req, { orgId, session }, extra) =>
  withRoleErrors(async () => {
    const userId = await userIdOf(extra);
    const body = await parseBody(req, putSchema);
    if (!body.ok) return body.res;
    const actor = await actorContext(session.user.id);
    await applyOverrides(actor, userId, orgId, body.data.overrides, req);
    return NextResponse.json({ level: (await loadOrgLevel(userId, orgId))! });
  }),
);
