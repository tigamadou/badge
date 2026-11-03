import { z } from "zod";
import { notifyPrintRequestMessage } from "@/lib/notifications/triggers";
import { PrintRequestError } from "@/lib/print-requests/errors";
import { loadRequest } from "@/lib/print-requests/service";
import { markRead } from "@/lib/print-requests/read-state";
import { listThread, postMessage, toEntryDTO } from "@/lib/print-requests/thread";
import { json, organizerRoute, parseBody } from "@/lib/print-requests/route";

export const GET = organizerRoute({ allowArchived: true }, async (req, { eventId, requestId, session }) => {
  await loadRequest(requestId, { eventId });
  const afterParam = req.nextUrl.searchParams.get("after");
  const after = afterParam ? new Date(afterParam) : undefined;
  if (after && Number.isNaN(after.getTime())) throw new PrintRequestError("VALIDATION", 400);
  // Capturé avant la lecture : une entrée arrivée pendant la requête restera non lue.
  const at = new Date();
  const entries = await listThread(requestId, "ORGANIZER", after ? { after } : {});
  // Le staff en consultation ne doit pas effacer ses propres non-lus (notes internes comprises).
  if (!session.user.isStaff) await markRead(requestId, session.user.id, at);
  return json({ entries });
});

const bodySchema = z.object({
  body: z.string(),
  attachmentKey: z.string().min(1).optional(),
  // Une note interne n'existe pas côté organisateur : tout champ en plus (dont `internal`) est refusé.
}).strict();

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
  return json({ entry: toEntryDTO(message, session.user.name, "ORGANIZER") }, 201);
});
