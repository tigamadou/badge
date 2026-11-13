import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth-participant";
import { prisma } from "@/lib/prisma";
import { loadDocForUser } from "@/lib/page-docs";

export const dynamic = "force-dynamic";

const MAX_PATH_LENGTH = 300;

function respond(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

// Lecture seule : la doc de la page `path`, filtrée par les permissions de l'utilisateur.
// « Pas de doc » et « accès refusé » ont la même réponse : on ne révèle pas l'existence d'une page.
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const account = await prisma.user.findUnique({ where: { id: user.id }, select: { archived: true, blocked: true } });
    if (!account || account.archived) throw new AuthError("NOT_AUTHENTICATED", 401);
    if (account.blocked) throw new AuthError("ACCOUNT_BLOCKED", 403);

    const path = req.nextUrl.searchParams.get("path");
    if (!path || path.length > MAX_PATH_LENGTH) {
      return respond({ code: "VALIDATION", error: "Paramètre path invalide." }, 400);
    }

    const doc = await loadDocForUser(user.id, path);
    if (!doc) return respond({ error: "NOT_FOUND" }, 404);
    return respond(doc, 200);
  } catch (err) {
    if (err instanceof AuthError) return respond({ code: err.code, error: err.message }, err.httpStatus);
    throw err;
  }
}
