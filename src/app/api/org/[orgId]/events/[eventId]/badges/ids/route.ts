import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { BADGE_LIST_ORDER, buildBadgeWhere } from "@/lib/badge-list-query";

// Tous les identifiants correspondant aux filtres de la liste (« Tout selectionner »), sans
// pagination ni limite : l'export des badges n'est pas borne (decision 13). Memes filtres que
// `GET …/badges`. Seuls les ids sont renvoyes (moindre privilege, reponse legere).
export const GET = withEventAuth(
  { permission: "badge.print", allowArchived: true },
  async (req, { eventId }) => {
    const where = buildBadgeWhere(eventId, new URL(req.url).searchParams);
    const rows = await prisma.registration.findMany({
      where,
      select: { id: true },
      orderBy: BADGE_LIST_ORDER,
    });
    return NextResponse.json({ ids: rows.map((r) => r.id) });
  },
);
