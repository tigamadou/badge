import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";

// ADR 2026-06-01 (v2-14 Task 4) : vue agregee pour role VIEWER (et au-dessus).
// Retourne UNIQUEMENT des chiffres -- aucune coordonnee nominative (email, nom,
// piece d'identite). Suffit a la consultation passive sans exposer de PII.
export const GET = withEventAuth({ minRole: "VIEWER" }, async (_req, { eventId }) => {
  const [totals, byCategory, quota] = await Promise.all([
    prisma.registration.groupBy({
      by: ["status"],
      where: { eventId },
      _count: { _all: true },
    }),
    prisma.registration.groupBy({
      by: ["categoryId"],
      where: { eventId },
      _count: { _all: true },
    }),
    (async () => {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { orgId: true, organization: { select: { quotaMaxRegistrations: true } } },
      });
      return event?.organization?.quotaMaxRegistrations ?? null;
    })(),
  ]);

  const categoryIds = byCategory.map((row) => row.categoryId);
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, color: true, number: true },
  });
  const catById = new Map(categories.map((c) => [c.id, c]));

  return NextResponse.json({
    totals: {
      pending: totals.find((t) => t.status === "PENDING")?._count._all ?? 0,
      approved: totals.find((t) => t.status === "APPROVED")?._count._all ?? 0,
      rejected: totals.find((t) => t.status === "REJECTED")?._count._all ?? 0,
    },
    byCategory: byCategory.map((row) => ({
      categoryId: row.categoryId,
      category: catById.get(row.categoryId) ?? null,
      count: row._count._all,
    })),
    quota: {
      max: quota,
      usedCountable:
        (totals.find((t) => t.status === "PENDING")?._count._all ?? 0) +
        (totals.find((t) => t.status === "APPROVED")?._count._all ?? 0),
    },
  });
});
