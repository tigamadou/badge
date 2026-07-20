import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";

// Liste des badges a imprimer (inscriptions APPROVED).
// Garde par la permission `badge.print` et non par `minRole` : la hierarchie
// des roles ne satisfait jamais un PRINTER "pur", alors que c'est precisement
// le role dont c'est le metier. DTO volontairement minimal (moindre privilege) :
// ni email ni structure, seulement ce qu'exige l'impression du badge.
// Pas de logActivity(BADGE_SCANNED) ici : lire la liste n'est pas un scan.
export const GET = withEventAuth(
  { permission: "badge.print", allowArchived: true },
  async (_req, { eventId }) => {
    const registrations = await prisma.registration.findMany({
      where: { eventId, status: "APPROVED" },
      select: {
        id: true,
        snapshotFirstName: true,
        snapshotLastName: true,
        badgePrinted: true,
        allAccessGranted: true,
        category: { select: { name: true, color: true, number: true } },
      },
      orderBy: [{ snapshotLastName: "asc" }, { snapshotFirstName: "asc" }],
      take: 200,
    });

    return NextResponse.json({
      registrations: registrations.map((r) => ({
        id: r.id,
        firstName: r.snapshotFirstName,
        lastName: r.snapshotLastName,
        badgePrinted: r.badgePrinted,
        allAccessGranted: r.allAccessGranted,
        category: r.category,
      })),
    });
  },
);
