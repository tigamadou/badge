import { prisma } from "@/lib/prisma";
import { loadMemberPermissions } from "@/lib/auth-guards";
import { updateDetails } from "@/lib/print-requests/content";
import { detailsPatchSchema } from "@/lib/print-requests/inputs";
import { onsiteTemplateStatus } from "@/lib/print-requests/onsite";
import { loadRequest, requestBadgeCount } from "@/lib/print-requests/service";
import { afterEdit, json, organizerRoute, parseBody, toOrganizerDTO, toLineDTO } from "@/lib/print-requests/route";

export const GET = organizerRoute({ allowArchived: true }, async (_req, { orgId, eventId, requestId, session }) => {
  const request = await loadRequest(requestId, { eventId });
  const [lines, badgeCount, memberPermissions] = await Promise.all([
    prisma.printQuoteLine.findMany({
      where: { requestId, removedAt: null },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    }),
    requestBadgeCount(prisma, request),
    loadMemberPermissions(session.user.id, { kind: "org", orgId }),
  ]);
  const canAccept = !session.user.isStaff && memberPermissions.has("print.quote.accept") && request.status === "QUOTED";
  const onsiteTemplate = await onsiteTemplateStatus(request);
  return json({ request: { ...toOrganizerDTO(request), onsiteTemplate }, lines: lines.map(toLineDTO), badgeCount, canAccept });
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
