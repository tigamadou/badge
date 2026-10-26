import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth-participant";
import { parseScopeQuery } from "@/lib/notifications/scope";
import { countUnread } from "@/lib/notifications/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const scope = parseScopeQuery(req.nextUrl.searchParams);
    if (!scope) {
      return NextResponse.json({ code: "INVALID_SCOPE", error: "Portée invalide." }, { status: 400 });
    }
    return NextResponse.json({ count: await countUnread(user.id, scope) });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ code: err.code, error: err.message }, { status: err.httpStatus });
    }
    throw err;
  }
}
