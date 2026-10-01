import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import type { StaffRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { requireStaff, AuthError } from "@/lib/auth-guards";

export type StaffAuthCtx = {
  session: Session;
};

type RouteParams<P extends Record<string, string> = Record<string, string>> = {
  params: Promise<P>;
};

export function withStaffAuth<P extends Record<string, string> = Record<string, string>>(
  handler: (req: NextRequest, ctx: StaffAuthCtx, extra: RouteParams<P>) => Promise<Response>,
  options?: { minRole?: StaffRole },
) {
  const minRole: StaffRole = options?.minRole ?? "STAFF_OBSERVER";
  return async (req: NextRequest, params: RouteParams<P>): Promise<Response> => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await requireStaff(session.user.id, minRole);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.code }, { status: err.httpStatus });
      }
      throw err;
    }

    return handler(req, { session }, params);
  };
}
