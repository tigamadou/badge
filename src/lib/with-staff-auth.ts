import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AuthError } from "@/lib/auth-guards";
import { loadUserContext } from "@/lib/user-context";
import { hasPermission, permissionScopeOf, type Permission } from "@/lib/permissions";

export type StaffAuthCtx = {
  session: Session;
};

type RouteParams<P extends Record<string, string> = Record<string, string>> = {
  params: Promise<P>;
};

export function withStaffAuth<P extends Record<string, string> = Record<string, string>>(
  handler: (req: NextRequest, ctx: StaffAuthCtx, extra: RouteParams<P>) => Promise<Response>,
  options: { permission: Permission | readonly Permission[] },
) {
  const permissions: readonly Permission[] =
    typeof options.permission === "string" ? [options.permission] : options.permission;
  if (permissions.some((p) => permissionScopeOf(p) !== "PLATFORM")) {
    throw new Error("withStaffAuth: la permission doit être de niveau PLATFORM");
  }
  return async (req: NextRequest, params: RouteParams<P>): Promise<Response> => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      // Un seul chargement du contexte : la permission est évaluée dessus.
      const ctx = await loadUserContext(session.user.id);
      if (!ctx) throw new AuthError("NOT_AUTHENTICATED", 401);
      if (!ctx.isStaff) throw new AuthError("NOT_STAFF", 403);
      if (!permissions.some((p) => hasPermission(ctx, p, { kind: "platform" }))) {
        throw new AuthError("PERMISSION_DENIED", 403);
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
