import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import type { OrgRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { requireOrgRole, requirePermission, AuthError } from "@/lib/auth-guards";
import { isPermission, permissionScopeOf, type Permission } from "@/lib/permissions";

export type OrgAuthCtx = {
  orgId: string;
  session: Session;
};

type RouteParams = { params: Promise<{ orgId: string }> };

// `guard` : une permission de niveau ORG (ou une liste, « au moins une »), ou un rôle hérité.
export function withOrgAuth(
  guard: Permission | readonly Permission[] | OrgRole,
  handler: (req: NextRequest, ctx: OrgAuthCtx, extra: RouteParams) => Promise<Response>,
) {
  const isRole = typeof guard === "string" && !isPermission(guard);
  const permissions: readonly Permission[] = isRole
    ? []
    : typeof guard === "string"
      ? [guard]
      : (guard as readonly Permission[]);
  if (permissions.some((p) => permissionScopeOf(p) !== "ORG")) {
    throw new Error("withOrgAuth: la permission doit être de niveau ORG");
  }
  return async (req: NextRequest, params: RouteParams): Promise<Response> => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params.params;
    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    try {
      if (isRole) {
        await requireOrgRole(session.user.id, orgId, guard as OrgRole);
      } else {
        await requirePermission(session.user.id, permissions, { kind: "org", orgId });
      }
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.code }, { status: err.httpStatus });
      }
      throw err;
    }

    return handler(req, { orgId, session }, params);
  };
}
