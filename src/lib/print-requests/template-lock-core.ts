import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Fichier feuille (sans import de service.ts) : service.ts et template-lock.ts l'importent tous
// deux sans cycle. Du paiement à la remise, le template de l'évènement ne change plus.
export const TEMPLATE_LOCK_STATUSES = ["PAID", "IN_PRODUCTION", "READY"] as const;

// Demande qui verrouille le template de l'évènement, ou null.
export async function findTemplateLock(
  eventId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<{ requestId: string; reference: string } | null> {
  const row = await db.printRequest.findFirst({
    where: { eventId, status: { in: [...TEMPLATE_LOCK_STATUSES] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, reference: true },
  });
  return row ? { requestId: row.id, reference: row.reference } : null;
}

// Retire l'épinglage du template d'une demande qui quitte les statuts qui le retiennent :
// l'évènement retrouve l'héritage s'il porte encore le template épinglé et qu'aucune autre
// demande ne le retient. Appelée par applyTransition : l'appelant doit avoir pris les verrous par
// lockRequestWithEvent (Event puis PrintRequest), sans quoi l'écriture de l'évènement ici
// inverserait l'ordre des verrous face à un changement de template.
export async function releaseTemplatePin(tx: Prisma.TransactionClient, requestId: string): Promise<void> {
  const request = await tx.printRequest.findUnique({
    where: { id: requestId },
    select: { eventId: true, badgeTemplateId: true, templatePinned: true },
  });
  if (!request?.templatePinned) return;
  const other = await tx.printRequest.findFirst({
    where: {
      eventId: request.eventId,
      id: { not: requestId },
      OR: [{ status: { in: [...TEMPLATE_LOCK_STATUSES] } }, { status: "ACCEPTED", templatePinned: true }],
    },
    select: { id: true },
  });
  if (!other && request.badgeTemplateId) {
    await tx.event.updateMany({
      where: { id: request.eventId, badgeTemplateId: request.badgeTemplateId },
      data: { badgeTemplateId: null },
    });
  }
  await tx.printRequest.update({ where: { id: requestId }, data: { templatePinned: false } });
}
