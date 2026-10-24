import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth-participant";
import { parseScopeQuery } from "@/lib/notifications/scope";
import {
  InvalidCursorError,
  NOTIFICATIONS_PAGE_SIZE,
  listNotifications,
} from "@/lib/notifications/queries";

export const dynamic = "force-dynamic";

// Un utilisateur ne lit que ses propres notifications : tout est filtré par userId.
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const params = req.nextUrl.searchParams;
    const scope = parseScopeQuery(params);
    if (!scope) {
      return NextResponse.json({ code: "INVALID_SCOPE", error: "Portée invalide." }, { status: 400 });
    }

    let limit: number | undefined;
    const rawLimit = params.get("limit");
    if (rawLimit !== null) {
      limit = Number(rawLimit);
      if (!Number.isInteger(limit) || limit < 1 || limit > NOTIFICATIONS_PAGE_SIZE) {
        return NextResponse.json(
          { code: "VALIDATION", error: "Paramètre limit invalide." },
          { status: 400 },
        );
      }
    }

    try {
      const result = await listNotifications(user.id, scope, {
        cursor: params.get("cursor") ?? undefined,
        unreadOnly: params.get("unread") === "1",
        limit,
      });
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof InvalidCursorError) {
        return NextResponse.json({ code: "INVALID_CURSOR", error: "Curseur invalide." }, { status: 400 });
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ code: err.code, error: err.message }, { status: err.httpStatus });
    }
    throw err;
  }
}
