import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import type { EventRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEventRole, getEffectiveEventRole } from "@/lib/auth-guards";
import type { EffectiveEventRole } from "@/types/auth";

export type EventAuthCtx = {
  orgId: string;
  eventId: string;
  effectiveRole: EffectiveEventRole;
  session: Session;
};

type RouteParams = { params: Promise<{ orgId: string; eventId: string }> };

export type WithEventAuthOptions = {
  minRole: EventRole;
  allowArchived?: boolean;
  requireRegistrationOpen?: boolean;
};

export function withEventAuth(
  options: WithEventAuthOptions,
  handler: (req: NextRequest, ctx: EventAuthCtx, extra: RouteParams) => Promise<Response>,
) {
  return async (req: NextRequest, params: RouteParams): Promise<Response> => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, eventId } = await params.params;
    if (!orgId || !eventId) {
      return NextResponse.json({ error: "Missing orgId or eventId" }, { status: 400 });
    }

    // Verifie la coherence URL : orgId du path doit matcher l'orgId reel de l'event.
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, orgId: true, archived: true, registrationOpen: true },
    });
    if (!event || event.orgId !== orgId) {
      // 404 plutot que 403 pour ne pas leaker l'existence d'un event sur une autre org.
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    if (event.archived && !options.allowArchived) {
      return NextResponse.json(
        { error: "EVENT_ARCHIVED", code: "EVENT_ARCHIVED" },
        { status: 410 },
      );
    }

    if (options.requireRegistrationOpen && !event.registrationOpen) {
      return NextResponse.json(
        { error: "REGISTRATION_CLOSED", code: "REGISTRATION_CLOSED" },
        { status: 409 },
      );
    }

    try {
      await requireEventRole(session.user.id, eventId, options.minRole);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.code }, { status: err.httpStatus });
      }
      throw err;
    }

    const effectiveRole = await getEffectiveEventRole(session.user.id, eventId);

    return handler(req, { orgId, eventId, effectiveRole, session }, params);
  };
}
