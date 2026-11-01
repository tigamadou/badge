import { z } from "zod";
import { notifyPrintRequestMessage } from "@/lib/notifications/triggers";
import { loadRequest } from "@/lib/print-requests/service";
import { listThread, postMessage, toEntryDTO } from "@/lib/print-requests/thread";
import { json, organizerRoute, parseBody } from "@/lib/print-requests/route";

export const GET = organizerRoute({ allowArchived: true }, async (_req, { eventId, requestId }) => {
  await loadRequest(requestId, { eventId });
  return json({ entries: await listThread(requestId) });
});

const bodySchema = z.object({
  body: z.string(),
  attachmentKey: z.string().min(1).optional(),
});

export const POST = organizerRoute({ allowArchived: true }, async (req, { eventId, requestId, session }) => {
  const { body, attachmentKey } = await parseBody(req, bodySchema);
  await loadRequest(requestId, { eventId });
  const message = await postMessage({
    requestId,
    authorId: session.user.id,
    side: "ORGANIZER",
    body,
    attachmentKey: attachmentKey ?? null,
  });
  await notifyPrintRequestMessage(message.id, session.user.id);
  return json({ entry: toEntryDTO(message, session.user.name) }, 201);
});
