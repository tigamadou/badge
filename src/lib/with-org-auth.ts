import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import type { OrgRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { requireOrgRole, AuthError } from "@/lib/auth-guards";

export type OrgAuthCtx = {
  orgId: string;
  session: Session;
};

type RouteParams = { params: Promise<{ orgId: string }> };

export function withOrgAuth(
  role: OrgRole,
  handler: (req: NextRequest, ctx: OrgAuthCtx, extra: RouteParams) => Promise<Response>,
) {
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
      await requireOrgRole(session.user.id, orgId, role);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.code }, { status: err.httpStatus });
      }
      throw err;
    }

    return handler(req, { orgId, session }, params);
  };
}
