import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findEffectiveTemplateRow, resolveEventTemplateId } from "@/lib/badge-templates/event-template-variables";
import { PrintRequestError } from "./errors";
import { lockEventRow } from "./content";
import { SYNCED_STATUSES, isPaymentInProgress, lockRequestWithEvent, syncLockedRequest } from "./service";
import { TEMPLATE_LOCK_STATUSES, findTemplateLock, releaseTemplatePin } from "./template-lock-core";

export { TEMPLATE_LOCK_STATUSES, findTemplateLock, releaseTemplatePin };

type Scope = { eventId: string } | { orgId: string } | { platform: true };

// Ids des commandes ACCEPTED de l'évènement dont un paiement est en cours (lignes verrouillées).
async function acceptedWithPayment(tx: Prisma.TransactionClient, eventId: string): Promise<string[]> {
  const accepted = await tx.printRequest.findMany({
    where: { eventId, status: "ACCEPTED" },
    select: { id: true },
  });
  const ids: string[] = [];
  for (const { id } of accepted) {
    await lockRequestWithEvent(tx, id);
    if (await isPaymentInProgress(id)) ids.push(id);
  }
  return ids;
}

// Refuse le changement de template d'un évènement : verrou (409 TEMPLATE_LOCKED_BY_PRINT_REQUEST)
// ou commande acceptée avec paiement en cours (409 PAYMENT_IN_PROGRESS). À appeler dans la
// transaction qui écrit, après lockEventRow, pour que le contrôle et l'écriture ne s'écartent pas.
export async function assertTemplateChangeAllowed(
  eventId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<void> {
  const lock = await findTemplateLock(eventId, db);
  if (lock) throw new PrintRequestError("TEMPLATE_LOCKED_BY_PRINT_REQUEST", 409, { reference: lock.reference });
  if ((await acceptedWithPayment(db, eventId)).length > 0) throw new PrintRequestError("PAYMENT_IN_PROGRESS", 409);
}

// Avant un changement de template d'organisation ou de plateforme : les évènements du périmètre
// qui héritent du template et sont verrouillés (ou ont un paiement en cours) gardent l'ancien
// template, épinglé sur l'évènement. Renvoie le nombre d'évènements épinglés.
export async function pinLockedEventTemplates(
  scope: { orgId: string } | { platform: true },
  db?: Prisma.TransactionClient,
): Promise<number> {
  return db ? pinIn(db, scope) : prisma.$transaction((tx) => pinIn(tx, scope));
}

async function pinIn(
  tx: Prisma.TransactionClient,
  scope: { orgId: string } | { platform: true },
): Promise<number> {
  const where =
    "orgId" in scope
      ? { orgId: scope.orgId, badgeTemplateId: null }
      : { badgeTemplateId: null, organization: { badgeTemplateId: null } };
  const candidates = await prisma.event.findMany({
    where: {
      ...where,
      printRequests: { some: { status: { in: [...TEMPLATE_LOCK_STATUSES, "ACCEPTED"] } } },
    },
    select: { id: true },
  });
  // Verrous des évènements en ordre d'identifiant croissant, tous pris avant la moindre lecture :
  // deux changements de template simultanés ne s'interbloquent pas et aucune commande ne passe
  // PAYÉE entre la lecture et l'écriture.
  const ids = candidates.map((c) => c.id).sort();
  for (const eventId of ids) await lockEventRow(tx, eventId);
  let pinned = 0;
  for (const eventId of ids) {
    const event = await tx.event.findUnique({ where: { id: eventId }, select: { badgeTemplateId: true, orgId: true } });
    if (!event || event.badgeTemplateId !== null) continue;
    const holding = new Set(await acceptedWithPayment(tx, eventId));
    const requests = await tx.printRequest.findMany({
      where: { eventId, status: { in: [...TEMPLATE_LOCK_STATUSES, "ACCEPTED"] } },
      select: { id: true, status: true, badgeTemplateId: true },
    });
    const holders = requests.filter(
      (r) => r.badgeTemplateId && (r.status !== "ACCEPTED" || holding.has(r.id)),
    );
    if (holders.length === 0) continue;
    // On fige le template effectif courant (celui qui va changer), pas la copie d'une commande :
    // une copie périmée ne doit pas re-figer l'évènement sur un ancien template. Sans template
    // effectif résolvable, on retombe sur la copie de la première commande qui le retient.
    const effective = await findEffectiveTemplateRow(await resolveEventTemplateId(event, tx), tx);
    await tx.event.update({
      where: { id: eventId },
      data: { badgeTemplateId: effective?.id ?? holders[0].badgeTemplateId },
    });
    await tx.printRequest.updateMany({
      where: { id: { in: holders.map((r) => r.id) } },
      data: { templatePinned: true },
    });
    pinned += 1;
  }
  return pinned;
}

// Après un changement de template : la copie des commandes en cours suit le template effectif.
// Les brouillons sont ignorés (leur copie est prise à l'envoi). Une commande ACCEPTED avec
// paiement en cours est laissée telle quelle. Renvoie les ids repassés en SUBMITTED.
export async function syncRequestTemplates(scope: Scope, actorId: string): Promise<string[]> {
  // actorId n'est pas utilisé ici (conservé pour la signature) : les entrées du fil sont écrites
  // par le système ; l'acteur ne sert qu'aux notifications faites par la route.
  void actorId;
  const where =
    "eventId" in scope ? { eventId: scope.eventId } : "orgId" in scope ? { orgId: scope.orgId } : {};
  const candidates = await prisma.printRequest.findMany({
    where: { ...where, status: { in: SYNCED_STATUSES } },
    select: { id: true },
  });
  const resubmitted: string[] = [];
  for (const { id } of candidates) {
    const changed = await prisma.$transaction(async (tx) => {
      // Commande disparue depuis la liste (évènement supprimé) : rien à synchroniser.
      const locked = await lockRequestWithEvent(tx, id).then(
        () => true,
        (err) => {
          if (err instanceof PrintRequestError) return false;
          throw err;
        },
      );
      if (!locked) return false;
      return syncLockedRequest(tx, id);
    });
    if (changed) resubmitted.push(id);
  }
  return resubmitted;
}
