import { prisma } from "@/lib/prisma";
import { updateDetails } from "@/lib/print-requests/content";
import { detailsPatchSchema } from "@/lib/print-requests/inputs";
import { loadRequest, requestBadgeCount } from "@/lib/print-requests/service";
import { afterEdit, json, organizerRoute, parseBody, toOrganizerDTO, toLineDTO } from "@/lib/print-requests/route";

export const GET = organizerRoute({ allowArchived: true }, async (_req, { orgId, eventId, requestId, session }) => {
  const request = await loadRequest(requestId, { eventId });
  const [lines, badgeCount, owner] = await Promise.all([
    prisma.printQuoteLine.findMany({
      where: { requestId, removedAt: null },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    }),
    requestBadgeCount(prisma, request),
    prisma.orgMembership.findFirst({ where: { userId: session.user.id, orgId, role: "OWNER" }, select: { userId: true } }),
  ]);
  const canAccept = !session.user.isStaff && owner !== null && request.status === "QUOTED";
  return json({ request: toOrganizerDTO(request), lines: lines.map(toLineDTO), badgeCount, canAccept });
});

export const PATCH = organizerRoute({ allowArchived: false }, async (req, ctx) => {
  const patch = await parseBody(req, detailsPatchSchema);
  const before = await loadRequest(ctx.requestId, { eventId: ctx.eventId });
  const { request, revised } = await updateDetails({
    requestId: ctx.requestId,
    eventId: ctx.eventId,
    userId: ctx.session.user.id,
    patch,
  });
  await afterEdit(req, ctx, before.status, revised, "details");
  return json({ request: toOrganizerDTO(request) });
});
