import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import type { EventRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEventRole } from "@/lib/auth-guards";
import { loadUserContext } from "@/lib/user-context";
import { effectiveEventRole as effectiveEventRolePure } from "@/lib/auth-helpers";
import {
  effectivePermissions,
  eventTargetOf,
  hasPermission,
  isStaffActor,
  permissionScopeOf,
  type Permission,
} from "@/lib/permissions";
import { loadOrgAccess } from "@/lib/subscription-access";
import { can } from "@/lib/subscription-rights";
import type { EffectiveEventRole, UserContext } from "@/types/auth";

export type EventAuthCtx = {
  session: Session;
  orgId: string;
  eventId: string;
  event: {
    id: string;
    orgId: string;
    archived: boolean;
    registrationOpen: boolean;
    date: Date;
    endDate: Date | null;
  };
  /** Permissions effectives de l'utilisateur sur l'évènement. */
  permissions: Set<Permission>;
  /** Staff agissant sans appartenance à l'organisation ni à l'évènement. */
  isStaffActor: boolean;
  /** @deprecated compat chantier roles-permissions (retiré à la fusion) */
  effectiveRole: EffectiveEventRole;
};

type RouteParams = { params: Promise<{ orgId: string; eventId: string }> };

// Deux modes d'autorisation, exclusifs :
//  - minRole    : hierarchie de roles (ADMIN > OPERATOR > PRINTER/VIEWER).
//  - permission : permission de niveau EVENT (ou liste, "au moins une"), resolue
//    sur les permissions effectives (role d'org + role d'evenement + ajustements).
//  - minRole    : @deprecated compat chantier roles-permissions (retire a la fusion).
export type WithEventAuthOptions = {
  /** @deprecated compat chantier roles-permissions (retiré à la fusion) */
  minRole?: EventRole;
  permission?: Permission | readonly Permission[];
  allowArchived?: boolean;
  requireRegistrationOpen?: boolean;
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function withEventAuth(
  options: WithEventAuthOptions,
  handler: (req: NextRequest, ctx: EventAuthCtx, extra: RouteParams) => Promise<Response>,
) {
  if (options.permission !== undefined && options.minRole !== undefined) {
    throw new Error("withEventAuth: permission et minRole sont exclusifs");
  }
  const required: readonly Permission[] | undefined =
    options.permission === undefined
      ? undefined
      : typeof options.permission === "string"
        ? [options.permission]
        : options.permission;
  if (required?.some((p) => permissionScopeOf(p) !== "EVENT")) {
    throw new Error("withEventAuth: la permission doit être de niveau EVENT");
  }
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
      select: {
        id: true,
        orgId: true,
        archived: true,
        registrationOpen: true,
        date: true,
        endDate: true,
      },
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

    const target = eventTargetOf(event);
    const loadCtx = async () => {
      const loaded = await loadUserContext(session.user.id);
      if (!loaded) throw new AuthError("NOT_AUTHENTICATED", 401);
      return loaded;
    };
    let userCtx: UserContext;
    try {
      if (required) {
        userCtx = await loadCtx();
        if (!required.some((p) => hasPermission(userCtx, p, target))) {
          throw new AuthError("PERMISSION_DENIED", 403);
        }
      } else if (options.minRole) {
        await requireEventRole(session.user.id, eventId, options.minRole);
        userCtx = await loadCtx();
      } else {
        throw new Error("withEventAuth: minRole ou permission requis");
      }
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.code }, { status: err.httpStatus });
      }
      throw err;
    }

    // Écriture sur un évènement : soumise au droit MANAGE_ONGOING_EVENTS (le staff n'est pas concerné).
    // Les lectures (GET/HEAD/OPTIONS) ne sont jamais refusées.
    if (!session.user.isStaff && !SAFE_METHODS.has(req.method.toUpperCase())) {
      const access = await loadOrgAccess(orgId);
      if (!can(access, "MANAGE_ONGOING_EVENTS", event)) {
        return NextResponse.json(
          { error: "SUBSCRIPTION_INACTIVE", code: "SUBSCRIPTION_INACTIVE" },
          { status: 403 },
        );
      }
    }

    return handler(
      req,
      {
        session,
        orgId,
        eventId,
        event,
        permissions: effectivePermissions(userCtx, target),
        isStaffActor: isStaffActor(userCtx, target),
        effectiveRole: effectiveEventRolePure(userCtx, eventId, orgId),
      },
      params,
    );
  };
}
