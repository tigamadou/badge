import { NextResponse } from "next/server";
import { z } from "zod";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { actorContext, createRole, createRoleSchema, listRoles, parseBody, withRoleErrors } from "@/lib/role-management";

const querySchema = z.object({
  scope: z.enum(["PLATFORM", "ORG", "EVENT"]).default("PLATFORM"),
  archived: z.enum(["true", "false"]).default("false"),
});

// Rôles système des trois niveaux en lecture ; rôles personnalisés : niveau plateforme uniquement.
export const GET = withStaffAuth(
  async (req) => {
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
    const roles = await listRoles({ scope: parsed.data.scope }, { includeArchived: parsed.data.archived === "true" });
    return NextResponse.json({ roles });
  },
  { permission: "platform.roles.manage" },
);

export const POST = withStaffAuth(
  (req, { session }) =>
    withRoleErrors(async () => {
      const body = await parseBody(req, createRoleSchema);
      if (!body.ok) return body.res;
      const actor = await actorContext(session.user.id);
      const role = await createRole(actor, { scope: "PLATFORM" }, body.data, req);
      return NextResponse.json({ role }, { status: 201 });
    }),
  { permission: "platform.roles.manage" },
);
