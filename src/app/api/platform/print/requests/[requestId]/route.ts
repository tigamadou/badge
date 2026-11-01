import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import {
  findEffectiveTemplateRow,
  resolveEventTemplateId,
} from "@/lib/badge-templates/event-template-variables";
import { guarded, json, lineDTO, loadStaffRequest, requestDTO } from "@/lib/print-requests/staff-api";

type Params = { requestId: string };

export const GET = withStaffAuth<Params>(async (_req, _ctx, { params }) =>
  guarded(async () => {
    const { requestId } = await params;
    const request = await loadStaffRequest(requestId);
    const [event, items, lines, generations] = await Promise.all([
      prisma.event.findUniqueOrThrow({
        where: { id: request.eventId },
        select: {
          id: true,
          title: true,
          date: true,
          endDate: true,
          location: true,
          badgeTemplateId: true,
          orgId: true,
          organization: { select: { id: true, name: true, contactEmail: true, contactPhone: true } },
        },
      }),
      prisma.printRequestItem.findMany({
        where: { requestId },
        orderBy: { position: "asc" },
        select: {
          registrationId: true,
          position: true,
          registration: {
            select: {
              snapshotFirstName: true,
              snapshotLastName: true,
              status: true,
              badgePrinted: true,
              category: { select: { name: true } },
            },
          },
        },
      }),
      prisma.printQuoteLine.findMany({
        where: { requestId, removedAt: null },
        orderBy: { position: "asc" },
      }),
      prisma.printSheetGeneration.findMany({
        where: { printRequestId: requestId },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, badgeCount: true, sheetCount: true, fileKey: true, createdAt: true },
      }),
    ]);

    // Copie prise à l'envoi ; à défaut, le template effectif de l'évènement.
    const row = await findEffectiveTemplateRow(request.badgeTemplateId ?? (await resolveEventTemplateId(event)));
    const template = row
      ? {
          id: row.id,
          label: row.label,
          widthPx: request.badgeWidthPx ?? row.pageWidthPx,
          heightPx: request.badgeHeightPx ?? row.pageHeightPx,
          pages: request.badgePages ?? row.pages,
          proofPath: row.proofPath,
        }
      : null;

    return json({
      request: requestDTO(request),
      event: {
        id: event.id,
        title: event.title,
        date: event.date,
        endDate: event.endDate,
        location: event.location,
        org: event.organization,
      },
      template,
      items: items.map((i) => ({
        registrationId: i.registrationId,
        position: i.position,
        firstName: i.registration.snapshotFirstName,
        lastName: i.registration.snapshotLastName,
        categoryName: i.registration.category.name,
        status: i.registration.status,
        badgePrinted: i.registration.badgePrinted,
      })),
      lines: lines.map(lineDTO),
      generations,
    });
  }),
);
