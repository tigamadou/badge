import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { BADGE_LIST_ORDER, buildBadgeWhere, parseBadgePage } from "@/lib/badge-list-query";

// Liste paginee des badges a imprimer (inscriptions APPROVED).
// Filtres : filter=all|unprinted|printed|allaccess, q (nom/prenom/id), categoryId.
// Garde par la permission `badge.print`. DTO volontairement minimal (moindre privilege) :
// ni email ni structure, seulement ce qu'exige l'impression du badge.
// Pas de logActivity(BADGE_SCANNED) ici : lire la liste n'est pas un scan.
export const GET = withEventAuth(
  { permission: "badge.print", allowArchived: true },
  async (req, { eventId }) => {
    const params = new URL(req.url).searchParams;
    const { page, pageSize } = parseBadgePage(params);
    const where = buildBadgeWhere(eventId, params);

    const [registrations, total] = await Promise.all([
      prisma.registration.findMany({
        where,
        select: {
          id: true,
          snapshotFirstName: true,
          snapshotLastName: true,
          badgePrinted: true,
          allAccessGranted: true,
          category: { select: { name: true, color: true, number: true } },
        },
        orderBy: BADGE_LIST_ORDER,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.registration.count({ where }),
    ]);

    return NextResponse.json({
      registrations: registrations.map((r) => ({
        id: r.id,
        firstName: r.snapshotFirstName,
        lastName: r.snapshotLastName,
        badgePrinted: r.badgePrinted,
        allAccessGranted: r.allAccessGranted,
        category: r.category,
      })),
      total,
      page,
      pageSize,
    });
  },
);
