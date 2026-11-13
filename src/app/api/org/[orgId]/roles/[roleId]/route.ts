import { NextResponse } from "next/server";
import { withOrgAuth } from "@/lib/with-org-auth";
import {
  actorContext,
  archiveRole,
  getRole,
  parseBody,
  updateRole,
  updateRoleSchema,
  withRoleErrors,
} from "@/lib/role-management";

// withOrgAuth type les paramètres avec le seul `orgId` ; la route porte aussi `roleId`.
const idOf = async (extra: unknown) => (await (extra as { params: Promise<{ roleId: string }> }).params).roleId;

export const GET = withOrgAuth("org.roles.manage", (_req, { orgId }, extra) =>
  withRoleErrors(async () => {
    const roleId = await idOf(extra);
    return NextResponse.json({ role: await getRole(roleId, { kind: "org", orgId }) });
  }),
);

export const PATCH = withOrgAuth("org.roles.manage", (req, { orgId, session }, extra) =>
  withRoleErrors(async () => {
    const roleId = await idOf(extra);
    const body = await parseBody(req, updateRoleSchema);
    if (!body.ok) return body.res;
    const actor = await actorContext(session.user.id);
    return NextResponse.json({ role: await updateRole(actor, { kind: "org", orgId }, roleId, body.data, req) });
  }),
);

// DELETE = archivage (soft delete).
export const DELETE = withOrgAuth("org.roles.manage", (req, { orgId, session }, extra) =>
  withRoleErrors(async () => {
    const roleId = await idOf(extra);
    const actor = await actorContext(session.user.id);
    return NextResponse.json({ role: await archiveRole(actor, { kind: "org", orgId }, roleId, req) });
  }),
);
