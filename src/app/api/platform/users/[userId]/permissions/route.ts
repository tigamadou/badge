import { NextResponse } from "next/server";
import { z } from "zod";
import { withStaffAuth } from "@/lib/with-staff-auth";
import {
  actorContext,
  applyOverrides,
  loadOrgLevel,
  loadPlatformLevels,
  overridesSchema,
  parseBody,
  withRoleErrors,
} from "@/lib/role-management";

type Params = { userId: string };

const putSchema = z.object({ orgId: z.string().min(1).nullable(), overrides: overridesSchema }).strict();

// Niveau plateforme (dont les droits participant) puis un niveau par organisation dont le compte est membre.
export const GET = withStaffAuth<Params>(
  async (_req, _ctx, { params }) => {
    const { userId } = await params;
    const levels = await loadPlatformLevels(userId);
    if (!levels) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ levels });
  },
  { permission: "users.permissions.manage" },
);

// Remplace l'ensemble des ajustements d'un niveau (`orgId` nul = plateforme).
export const PUT = withStaffAuth<Params>(
  (req, { session }, { params }) =>
    withRoleErrors(async () => {
      const { userId } = await params;
      const body = await parseBody(req, putSchema);
      if (!body.ok) return body.res;
      const { orgId, overrides } = body.data;
      const actor = await actorContext(session.user.id);
      await applyOverrides(actor, userId, orgId, overrides, req);
      const level = orgId === null ? (await loadPlatformLevels(userId))![0] : (await loadOrgLevel(userId, orgId))!;
      return NextResponse.json({ level });
    }),
  { permission: "users.permissions.manage" },
);
