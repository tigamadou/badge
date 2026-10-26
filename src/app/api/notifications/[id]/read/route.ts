import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth-participant";
import { markRead } from "@/lib/notifications/queries";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    // 404 (jamais 403) pour une notification d'autrui : on ne révèle pas son existence.
    if (!(await markRead(user.id, id))) {
      return NextResponse.json({ code: "NOT_FOUND", error: "Notification introuvable." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ code: err.code, error: err.message }, { status: err.httpStatus });
    }
    throw err;
  }
}
