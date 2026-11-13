import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { resolveEventTemplate } from "@/lib/badge-templates/render-badge";
import { pxToMm } from "@/lib/print-sheets/units";

// Limite alignee sur la selection par identifiants de POST /sheets (objet : abaissable en test).
export const OPTIONS_LIMITS = { maxRegistrations: 5000 };

// Donnees du formulaire de generation. Sans parametre : organisations -> evenements ->
// categories avec le nombre d'inscriptions approuvees. Avec ?eventId= : en plus, le
// format du badge effectif (mm) et les inscriptions approuvees de l'evenement.
export const GET = withStaffAuth(
  async (req) => {
    const eventId = new URL(req.url).searchParams.get("eventId");

    if (eventId) {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, orgId: true, badgeTemplateId: true },
      });
      if (!event) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      const [template, registrations, total] = await Promise.all([
        resolveEventTemplate(event),
        prisma.registration.findMany({
          where: { eventId, status: "APPROVED" },
          orderBy: [{ snapshotLastName: "asc" }, { snapshotFirstName: "asc" }, { id: "asc" }],
          take: OPTIONS_LIMITS.maxRegistrations,
          select: { id: true, snapshotFirstName: true, snapshotLastName: true, categoryId: true },
        }),
        prisma.registration.count({ where: { eventId, status: "APPROVED" } }),
      ]);
      return NextResponse.json({
        event: {
          id: event.id,
          badgeMm: {
            width: pxToMm(parseFloat(template.meta.pageSize.width)),
            height: pxToMm(parseFloat(template.meta.pageSize.height)),
          },
          badgePages: template.meta.pages === 2 ? 2 : 1,
          total,
          truncated: total > registrations.length,
          registrations: registrations.map((r) => ({
            id: r.id,
            firstName: r.snapshotFirstName,
            lastName: r.snapshotLastName,
            categoryId: r.categoryId,
          })),
        },
      });
    }

    const [orgs, approved] = await Promise.all([
      prisma.organization.findMany({
        where: { archived: false },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          events: {
            where: { archived: false },
            orderBy: { date: "desc" },
            select: {
              id: true,
              title: true,
              date: true,
              categories: { orderBy: { number: "asc" }, select: { id: true, name: true, number: true } },
            },
          },
        },
      }),
      prisma.registration.groupBy({
        by: ["eventId", "categoryId"],
        where: { status: "APPROVED" },
        _count: { _all: true },
      }),
    ]);
    const perCategory = new Map(approved.map((a) => [a.categoryId, a._count._all]));
    const perEvent = new Map<string, number>();
    for (const a of approved) perEvent.set(a.eventId, (perEvent.get(a.eventId) ?? 0) + a._count._all);

    return NextResponse.json({
      organizations: orgs.map((o) => ({
        id: o.id,
        name: o.name,
        events: o.events.map((e) => ({
          id: e.id,
          title: e.title,
          date: e.date,
          approvedCount: perEvent.get(e.id) ?? 0,
          categories: e.categories.map((c) => ({ ...c, approvedCount: perCategory.get(c.id) ?? 0 })),
        })),
      })),
    });
  },
  { permission: "print.sheets.generate" },
);
