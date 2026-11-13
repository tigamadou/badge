import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, AuthError } from "@/lib/auth-guards";
import { permissionScopeOf, type Permission } from "@/lib/permissions";

export type OrgAuthCtx = {
  orgId: string;
  session: Session;
};

type RouteParams = { params: Promise<{ orgId: string }> };

// `guard` : une permission de niveau ORG (ou une liste, « au moins une »).
export function withOrgAuth(
  guard: Permission | readonly Permission[],
  handler: (req: NextRequest, ctx: OrgAuthCtx, extra: RouteParams) => Promise<Response>,
) {
  const permissions: readonly Permission[] = typeof guard === "string" ? [guard] : guard;
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
      await requirePermission(session.user.id, permissions, { kind: "org", orgId });
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.code }, { status: err.httpStatus });
      }
      throw err;
    }

    return handler(req, { orgId, session }, params);
  };
}
