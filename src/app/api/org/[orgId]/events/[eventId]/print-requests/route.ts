import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createDraft } from "@/lib/print-requests/service";
import { json, organizerRoute, parseBody } from "@/lib/print-requests/route";

export const GET = organizerRoute({ allowArchived: true }, async (_req, { eventId }) => {
  const rows = await prisma.printRequest.findMany({
    where: { eventId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { _count: { select: { items: true } } },
  });
  return json({
    requests: rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      type: r.type,
      status: r.status,
      badgeCount: r.type === "ADVANCE" ? r._count.items : (r.estimatedQuantity ?? 0),
      total: r.total,
      submittedAt: r.submittedAt,
      wantedBy: r.wantedBy,
    })),
  });
});

const createSchema = z.object({ type: z.enum(["ADVANCE", "ONSITE"]) });

export const POST = organizerRoute({ allowArchived: false }, async (req, { orgId, eventId, session }) => {
  const { type } = await parseBody(req, createSchema);
  const request = await createDraft({ eventId, orgId, type, userId: session.user.id });
  return json({ request }, 201);
});
