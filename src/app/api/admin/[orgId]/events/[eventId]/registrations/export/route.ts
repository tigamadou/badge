import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { toRegistrationCsv } from "@/lib/registration-csv";

export const GET = withEventAuth({ minRole: "ADMIN", allowArchived: true }, async (req, { orgId, eventId, session }) => {
  const regs = await prisma.registration.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    include: { category: { select: { name: true } } },
  });

  const csv = toRegistrationCsv(
    regs.map((r) => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      structure: r.structure,
      categoryName: r.category.name,
      status: r.status,
      idDocumentType: r.idDocumentType,
      idDocumentNumber: r.idDocumentNumber,
      badgePrinted: r.badgePrinted,
      allAccessGranted: r.allAccessGranted,
      createdAt: r.createdAt,
    })),
  );

  await logActivity({
    type: "BADGE_BATCH_EXPORTED",
    userId: session.user.id,
    orgId,
    eventId,
    details: { format: "csv", count: regs.length },
    req,
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="registrations-${eventId}.csv"`,
    },
  });
});
