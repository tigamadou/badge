import { z } from "zod";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { notifyPrintRequestMessage } from "@/lib/notifications/triggers";
import { listThread, postMessage } from "@/lib/print-requests/thread";
import { guarded, json, loadStaffRequest, parseBody } from "@/lib/print-requests/staff-api";

type Params = { requestId: string };

const bodySchema = z.object({
  body: z.string(),
  attachmentKey: z.string().nullable().optional(),
});

export const GET = withStaffAuth<Params>(async (_req, _ctx, { params }) =>
  guarded(async () => {
    const { requestId } = await params;
    await loadStaffRequest(requestId);
    return json({ entries: await listThread(requestId) });
  }),
);

export const POST = withStaffAuth<Params>(
  async (req, { session }, { params }) =>
    guarded(async () => {
      const { requestId } = await params;
      await loadStaffRequest(requestId);
      const input = await parseBody(req, bodySchema);
      const userId = session.user.id;
      const message = await postMessage({
        requestId,
        authorId: userId,
        side: "STAFF",
        body: input.body,
        attachmentKey: input.attachmentKey ?? null,
      });
      await notifyPrintRequestMessage(message.id, userId);
      return json(
        {
          entry: {
            id: message.id,
            side: message.side,
            kind: message.kind,
            body: message.body,
            eventType: message.eventType,
            details: message.details,
            attachmentKey: message.attachmentKey,
            authorName: session.user.name ?? null,
            createdAt: message.createdAt.toISOString(),
          },
        },
        201,
      );
    }),
  { minRole: "STAFF_SUPPORT" },
);
