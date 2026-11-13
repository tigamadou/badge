import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { actorContext, listAssignableRoles } from "@/lib/role-management";

const querySchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("PLATFORM") }),
  z.object({ scope: z.literal("ORG"), orgId: z.string().min(1) }),
]);

// Alimente les sélecteurs de rôle : rôle plateforme d'un compte, ou rôle d'organisation d'un membre.
export const GET = withStaffAuth(
  async (req, { session }) => {
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
    const actor = await actorContext(session.user.id);
    if (parsed.data.scope === "PLATFORM") {
      const roles = await listAssignableRoles(actor, { scope: "PLATFORM" }, { kind: "platform" });
      return NextResponse.json({ roles });
    }
    const { orgId } = parsed.data;
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!org) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const roles = await listAssignableRoles(actor, { scope: "ORG", orgId }, { kind: "org", orgId });
    return NextResponse.json({ roles });
  },
  { permission: "platform.access" },
);
