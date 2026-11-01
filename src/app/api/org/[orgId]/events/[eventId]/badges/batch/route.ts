import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { chunk } from "@/lib/badge-batch";

export const runtime = "nodejs";

// Aucun maximum sur les identifiants : la sélection voyage dans le corps, pas dans l'URL.
const bodySchema = z.object({ ids: z.array(z.string().min(1)) });

// Taille des lectures : borne le nombre de paramètres d'une même requête SQL.
const READ_CHUNK = 5000;

// Lignes du panneau d'impression par lot : inscriptions approuvées de l'évènement, dans l'ordre de
// la sélection, avec le strict nécessaire à l'affichage (pas d'e-mail, pas de structure). Les
// identifiants inconnus, d'un autre évènement ou non approuvés sont comptés dans `ignored`.
export const POST = withEventAuth(
  { permission: "badge.print", allowArchived: true },
  async (req, { eventId }) => {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
    }
    const ids = [...new Set(parsed.data.ids)];
    const found = (
      await Promise.all(
        chunk(ids, READ_CHUNK).map((part) =>
          prisma.registration.findMany({
            where: { id: { in: part }, eventId, status: "APPROVED" },
            select: {
              id: true,
              snapshotFirstName: true,
              snapshotLastName: true,
              badgePrinted: true,
              category: { select: { name: true, color: true, anonymous: true, neutralBadge: true } },
            },
          }),
        ),
      )
    ).flat();
    const byId = new Map(found.map((r) => [r.id, r]));
    const badges = ids.flatMap((id) => {
      const r = byId.get(id);
      if (!r) return [];
      return [
        {
          id: r.id,
          label: r.category.anonymous ? "Identité masquée" : `${r.snapshotFirstName} ${r.snapshotLastName}`,
          categoryName: r.category.name,
          categoryColor: r.category.neutralBadge ? "#334155" : r.category.color,
          printed: r.badgePrinted,
        },
      ];
    });
    return NextResponse.json({ badges, ignored: ids.length - badges.length });
  },
);
