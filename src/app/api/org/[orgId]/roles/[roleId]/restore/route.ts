import { NextResponse } from "next/server";
import { withOrgAuth } from "@/lib/with-org-auth";
import { actorContext, restoreRole, withRoleErrors } from "@/lib/role-management";

export const POST = withOrgAuth("org.roles.manage", (req, { orgId, session }, extra) =>
  withRoleErrors(async () => {
    const { roleId } = (await extra.params) as unknown as { roleId: string };
    const actor = await actorContext(session.user.id);
    return NextResponse.json({ role: await restoreRole(actor, { kind: "org", orgId }, roleId, req) });
  }),
);
