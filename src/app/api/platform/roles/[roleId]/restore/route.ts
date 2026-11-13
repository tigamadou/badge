import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { actorContext, restoreRole, withRoleErrors } from "@/lib/role-management";

export const POST = withStaffAuth<{ roleId: string }>(
  (req, { session }, { params }) =>
    withRoleErrors(async () => {
      const { roleId } = await params;
      const actor = await actorContext(session.user.id);
      return NextResponse.json({ role: await restoreRole(actor, { kind: "platform" }, roleId, req) });
    }),
  { permission: "platform.roles.manage" },
);
