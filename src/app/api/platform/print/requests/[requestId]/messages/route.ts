import { z } from "zod";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { notifyPrintRequestMessage } from "@/lib/notifications/triggers";
import { PrintRequestError } from "@/lib/print-requests/errors";
import { markRead } from "@/lib/print-requests/read-state";
import { listThread, postMessage, toEntryDTO } from "@/lib/print-requests/thread";
import { guarded, json, loadStaffRequest, parseBody } from "@/lib/print-requests/staff-api";

type Params = { requestId: string };

const bodySchema = z.object({
  body: z.string(),
  attachmentKey: z.string().nullable().optional(),
  internal: z.boolean().optional(),
});

export const GET = withStaffAuth<Params>(async (req, { session }, { params }) =>
  guarded(async () => {
    const { requestId } = await params;
    await loadStaffRequest(requestId);
    const rawAfter = req.nextUrl.searchParams.get("after");
    let after: Date | undefined;
    if (rawAfter !== null) {
      after = new Date(rawAfter);
      if (Number.isNaN(after.getTime())) throw new PrintRequestError("VALIDATION", 400);
    }
    // Instant pris avant la lecture : une entrée arrivée pendant la lecture reste non lue.
    const at = new Date();
    const entries = await listThread(requestId, "STAFF", after ? { after } : {});
    await markRead(requestId, session.user.id, at);
    return json({ entries });
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
        internal: input.internal ?? false,
      });
      await notifyPrintRequestMessage(message.id, userId);
      return json({ entry: toEntryDTO(message, session.user.name ?? null, "STAFF") }, 201);
    }),
  { minRole: "STAFF_SUPPORT" },
);
