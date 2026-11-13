import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { eventTargetOf } from "@/lib/permissions";
import { withOrgAuth } from "@/lib/with-org-auth";
import { actorContext, listAssignableRoles } from "@/lib/role-management";

const querySchema = z.object({
  scope: z.enum(["ORG", "EVENT"]),
  eventId: z.string().min(1).optional(),
});

// Alimente les sélecteurs de rôle des membres d'organisation (ORG) et d'évènement (EVENT).
export const GET = withOrgAuth("org.read", async (req, { orgId, session }) => {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  const { scope, eventId } = parsed.data;
  let target = { kind: "org", orgId } as Parameters<typeof listAssignableRoles>[2];
  if (eventId) {
    const event = await prisma.event.findFirst({ where: { id: eventId, orgId }, select: { id: true } });
    if (!event) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    target = eventTargetOf({ eventId, orgId });
  }
  const actor = await actorContext(session.user.id);
  return NextResponse.json({ roles: await listAssignableRoles(actor, { scope, orgId }, target) });
});
