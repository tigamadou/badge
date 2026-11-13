import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/with-staff-auth";
import {
  actorContext,
  archiveRole,
  getRole,
  parseBody,
  updateRole,
  updateRoleSchema,
  withRoleErrors,
} from "@/lib/role-management";

type Params = { roleId: string };
const owner = { kind: "platform" } as const;

export const GET = withStaffAuth<Params>(
  (_req, _ctx, { params }) =>
    withRoleErrors(async () => {
      const { roleId } = await params;
      return NextResponse.json({ role: await getRole(roleId, owner) });
    }),
  { permission: "platform.roles.manage" },
);

export const PATCH = withStaffAuth<Params>(
  (req, { session }, { params }) =>
    withRoleErrors(async () => {
      const { roleId } = await params;
      const body = await parseBody(req, updateRoleSchema);
      if (!body.ok) return body.res;
      const actor = await actorContext(session.user.id);
      return NextResponse.json({ role: await updateRole(actor, owner, roleId, body.data, req) });
    }),
  { permission: "platform.roles.manage" },
);

// DELETE = archivage (soft delete).
export const DELETE = withStaffAuth<Params>(
  (req, { session }, { params }) =>
    withRoleErrors(async () => {
      const { roleId } = await params;
      const actor = await actorContext(session.user.id);
      return NextResponse.json({ role: await archiveRole(actor, owner, roleId, req) });
    }),
  { permission: "platform.roles.manage" },
);
