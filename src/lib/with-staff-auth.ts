import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import type { StaffRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { requireStaff, requirePermission, AuthError } from "@/lib/auth-guards";
import { loadUserContext } from "@/lib/user-context";
import { permissionScopeOf, type Permission } from "@/lib/permissions";

export type StaffAuthCtx = {
  session: Session;
};

type RouteParams<P extends Record<string, string> = Record<string, string>> = {
  params: Promise<P>;
};

function toList(p: Permission | readonly Permission[] | undefined): readonly Permission[] | undefined {
  if (p === undefined) return undefined;
  return typeof p === "string" ? [p] : p;
}

export function withStaffAuth<P extends Record<string, string> = Record<string, string>>(
  handler: (req: NextRequest, ctx: StaffAuthCtx, extra: RouteParams<P>) => Promise<Response>,
  options?: { permission?: Permission | readonly Permission[]; minRole?: StaffRole },
) {
  // Deux modes exclusifs : `permission` (spec 37) ou `minRole` (hérité, valeur par défaut STAFF_OBSERVER).
  if (options?.permission !== undefined && options.minRole !== undefined) {
    throw new Error("withStaffAuth: permission et minRole sont exclusifs");
  }
  const permissions = toList(options?.permission);
  if (permissions?.some((p) => permissionScopeOf(p) !== "PLATFORM")) {
    throw new Error("withStaffAuth: la permission doit être de niveau PLATFORM");
  }
  /** @deprecated compat chantier roles-permissions (retiré à la fusion) */
  const minRole: StaffRole = options?.minRole ?? "STAFF_OBSERVER";
  return async (req: NextRequest, params: RouteParams<P>): Promise<Response> => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      if (options?.permission !== undefined) {
        const ctx = await loadUserContext(session.user.id);
        if (!ctx) throw new AuthError("NOT_AUTHENTICATED", 401);
        if (!ctx.isStaff) throw new AuthError("NOT_STAFF", 403);
        await requirePermission(session.user.id, options.permission, { kind: "platform" });
      } else {
        await requireStaff(session.user.id, minRole);
      }
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.code }, { status: err.httpStatus });
      }
      throw err;
    }

    return handler(req, { session }, params);
  };
}
