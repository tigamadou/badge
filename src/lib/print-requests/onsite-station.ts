import type { Prisma, PrintRequest, PrintRequestPrint, RegistrationStatus } from "@prisma/client";
import { sendBadgePrintedNotification } from "@/lib/mail";
import { notifyBadgePrinted } from "@/lib/notifications/triggers";
import { prisma } from "@/lib/prisma";
import { assertEventImagesCompliantById } from "@/lib/event-image-compliance";
import { parseRegistrationQr } from "@/lib/registration-qr";
import { OnsiteError } from "./onsite";
import { computeOnsiteCounter, orderedBadgeLine, type OnsiteCounter } from "./onsite-counter";
import { lockRequestWithEvent } from "./service";
import { appendThreadEvent } from "./thread";

// Poste d'impression sur place : recherche, lecture du QR et impression journalisée.

export type OnsiteRegistrationCard = {
  id: string;
  snapshotFirstName: string;
  snapshotLastName: string;
  snapshotEmail: string;
  snapshotPhoto: string;
  status: RegistrationStatus;
  category: { name: string; color: string };
  badgePrinted: boolean;
  badgePrintedAt: Date | null;
  /** Déjà imprimé AU POSTE pour cette commande (journal) : seule une telle impression est une réimpression. */
  printedOnsite: boolean;
};

const SEARCH_MIN_LENGTH = 2;
const SEARCH_LIMIT = 20;
const LOCKED_STATUSES: string[] = ["COMPLETED", "CANCELLED", "REJECTED"];
const PRINTABLE_STATUSES = ["PAID", "IN_PRODUCTION", "READY"];

const CARD_SELECT = {
  id: true,
  eventId: true,
  snapshotFirstName: true,
  snapshotLastName: true,
  snapshotEmail: true,
  snapshotPhoto: true,
  status: true,
  badgePrinted: true,
  badgePrintedAt: true,
  category: { select: { name: true, color: true } },
} satisfies Prisma.RegistrationSelect;

type Db = Prisma.TransactionClient;

// `%` et `_` sont des jokers de LIKE : on les neutralise pour qu'ils soient cherchés tels quels.
const escapeLike = (term: string) => term.replace(/[\\%_]/g, (c) => `\\${c}`);

function toCard(
  reg: Prisma.RegistrationGetPayload<{ select: typeof CARD_SELECT }>,
  printedOnsite: boolean,
): OnsiteRegistrationCard {
  return {
    id: reg.id,
    snapshotFirstName: reg.snapshotFirstName,
    snapshotLastName: reg.snapshotLastName,
    snapshotEmail: reg.snapshotEmail,
    snapshotPhoto: reg.snapshotPhoto,
    status: reg.status,
    category: reg.category,
    badgePrinted: reg.badgePrinted,
    badgePrintedAt: reg.badgePrintedAt,
    printedOnsite,
  };
}

// Lecture de la commande et de son compteur (premières impressions seulement : le journal sans réimpressions).
async function loadWith(db: Db | typeof prisma, requestId: string) {
  const request = await db.printRequest.findUnique({
    where: { id: requestId },
    include: {
      event: { select: { orgId: true } },
      lines: {
        where: { removedAt: null },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: { kind: true, quantity: true, unitPrice: true, removedAt: true, product: { select: { kind: true } } },
      },
    },
  });
  if (!request) throw new OnsiteError("NOT_FOUND", 404);
  if (request.type !== "ONSITE" || request.parentRequestId !== null) throw new OnsiteError("NOT_ONSITE", 409);
  const printed = await db.printRequestPrint.count({ where: { requestId, reprint: false } });
  const { event, lines, ...plain } = request;
  const badgeLine = orderedBadgeLine(lines);
  const counter = computeOnsiteCounter({
    ordered: badgeLine?.quantity ?? plain.estimatedQuantity ?? 0,
    marginPercent: plain.marginPercent ?? 0,
    printed,
  });
  return {
    request: plain as PrintRequest,
    orgId: event.orgId,
    eventId: plain.eventId,
    counter,
    hasBadgeLine: badgeLine !== null,
  };
}

// Lecture sans condition de statut : compteur des pages de détail, ids de la route de marge.
export function loadOnsiteOverview(requestId: string) {
  return loadWith(prisma, requestId);
}

// Le poste ne sert qu'une commande payée : un brouillon est invisible, les autres statuts sont refusés.
export async function loadOnsiteRequest(requestId: string) {
  const loaded = await loadWith(prisma, requestId);
  const { status } = loaded.request;
  if (status === "DRAFT") throw new OnsiteError("NOT_FOUND", 404);
  if (!PRINTABLE_STATUSES.includes(status)) throw new OnsiteError("REQUEST_NOT_PRINTABLE", 409);
  return loaded;
}

// Contrôles communs : l'inscription existe, appartient à l'évènement de la commande et est approuvée.
async function findPrintableRegistration(db: Db | typeof prisma, eventId: string, registrationId: string) {
  const reg = await db.registration.findUnique({ where: { id: registrationId }, select: CARD_SELECT });
  if (!reg) throw new OnsiteError("REGISTRATION_NOT_FOUND", 404);
  if (reg.eventId !== eventId) throw new OnsiteError("FOREIGN_EVENT", 404);
  if (reg.status !== "APPROVED") throw new OnsiteError("NOT_APPROVED", 409, { status: reg.status });
  return reg;
}

export async function lookupOnsiteRegistration(requestId: string, payload: string): Promise<OnsiteRegistrationCard> {
  const { eventId } = await loadOnsiteRequest(requestId);
  const reg = await findPrintableRegistration(prisma, eventId, parseRegistrationQr(payload));
  const printed = await prisma.printRequestPrint.count({ where: { requestId, registrationId: reg.id } });
  return toCard(reg, printed > 0);
}

export async function searchOnsiteRegistrations(requestId: string, q: string): Promise<OnsiteRegistrationCard[]> {
  const { eventId } = await loadOnsiteRequest(requestId);
  const trimmed = q.trim();
  if (trimmed.length < SEARCH_MIN_LENGTH) return [];
  const term = escapeLike(trimmed);
  const regs = await prisma.registration.findMany({
    where: {
      eventId,
      OR: [
        { snapshotFirstName: { contains: term } },
        { snapshotLastName: { contains: term } },
        { snapshotEmail: { contains: term } },
        { id: { startsWith: term } },
      ],
    },
    select: CARD_SELECT,
    orderBy: [{ snapshotLastName: "asc" }, { snapshotFirstName: "asc" }],
    take: SEARCH_LIMIT,
  });
  const done = await prisma.printRequestPrint.findMany({
    where: { requestId, registrationId: { in: regs.map((r) => r.id) } },
    select: { registrationId: true },
    distinct: ["registrationId"],
  });
  const printedHere = new Set(done.map((d) => d.registrationId));
  return regs.map((r) => toCard(r, printedHere.has(r.id)));
}

export async function recordOnsitePrint(input: {
  requestId: string;
  registrationId: string;
  userId: string;
  confirmReprint: boolean;
}): Promise<{ print: PrintRequestPrint; counter: OnsiteCounter }> {
  const { requestId, registrationId, userId, confirmReprint } = input;
  const target = await prisma.printRequest.findUnique({ where: { id: requestId }, select: { eventId: true } });
  if (target) await assertEventImagesCompliantById(target.eventId);
  const result = await prisma.$transaction(async (tx) => {
    // Ordre des verrous : Event puis PrintRequest (jamais la commande seule).
    await lockRequestWithEvent(tx, requestId);
    const { request, eventId, counter, hasBadgeLine } = await loadWith(tx, requestId);
    if (!PRINTABLE_STATUSES.includes(request.status)) throw new OnsiteError("REQUEST_NOT_PRINTABLE", 409);
    // Sans ligne de badges il n'y a pas de commande à honorer : pas de repli sur la quantité estimée.
    if (!hasBadgeLine) throw new OnsiteError("REQUEST_NOT_PRINTABLE", 409);
    const reg = await findPrintableRegistration(tx, eventId, registrationId);
    // Réimpression = déjà imprimée AU POSTE pour cette commande (journal lu sous verrou). Un badge
    // marqué imprimé par l'organisateur reste une première impression : sinon l'organisateur
    // marquerait tout « imprimé » pour obtenir des badges hors compteur.
    const printedHere = (await tx.printRequestPrint.count({ where: { requestId, registrationId } })) > 0;
    // `badgePrinted` ne sert qu'à l'avertissement « déjà imprimé le … » : la confirmation reste demandée.
    if ((printedHere || reg.badgePrinted) && !confirmReprint) {
      throw new OnsiteError("ALREADY_PRINTED", 409, { printedAt: reg.badgePrintedAt });
    }
    // Une réimpression ne compte pas : elle passe même au plafond.
    const reprint = printedHere;
    if (!reprint && counter.printed >= counter.cap) throw new OnsiteError("CAP_REACHED", 409);
    const print = await tx.printRequestPrint.create({
      data: { requestId, registrationId, printedById: userId, reprint },
    });
    await tx.registration.update({
      where: { id: registrationId },
      data: { badgePrinted: true, badgePrintedAt: print.printedAt },
    });
    const nextPrinted = reprint ? counter.printed : counter.printed + 1;
    return {
      print,
      reprint,
      counter: computeOnsiteCounter({ ordered: counter.ordered, marginPercent: counter.marginPercent, printed: nextPrinted }),
    };
  });

  // Première impression seulement : notification, puis courriel (son échec ne bloque pas).
  if (!result.reprint) {
    await notifyBadgePrinted([registrationId], userId);
    try {
      await sendBadgePrintedNotification(registrationId);
    } catch (e) {
      console.error("[mail] sendBadgePrintedNotification failed", e);
    }
  }
  return { print: result.print, counter: result.counter };
}

// Réglage de la marge (hausse comme baisse) : la seule limite est le nombre déjà imprimé.
export async function setOnsiteMargin(input: {
  requestId: string;
  marginPercent: number;
  reason: string;
  userId: string;
}): Promise<{ counter: OnsiteCounter; from: number }> {
  const { requestId, marginPercent, reason, userId } = input;
  return prisma.$transaction(async (tx) => {
    // Ordre des verrous : Event puis PrintRequest (jamais la commande seule).
    await lockRequestWithEvent(tx, requestId);
    const { request, counter } = await loadWith(tx, requestId);
    // Un brouillon est invisible du staff ; une commande terminée ne se règle plus.
    if (request.status === "DRAFT") throw new OnsiteError("NOT_FOUND", 404);
    if (LOCKED_STATUSES.includes(request.status)) throw new OnsiteError("REQUEST_LOCKED", 409);
    // `counter.marginPercent` vaut 0 pour une marge nulle en base (marge nulle en base -> from: 0).
    const from = counter.marginPercent;
    // Même marge : rien à écrire, ni fil ni journal.
    if (from === marginPercent) return { counter, from };
    const next = computeOnsiteCounter({ ordered: counter.ordered, marginPercent, printed: counter.printed });
    if (next.cap < counter.printed) throw new OnsiteError("MARGIN_BELOW_PRINTED", 409);
    await tx.printRequest.update({ where: { id: requestId }, data: { marginPercent } });
    await appendThreadEvent(
      tx,
      requestId,
      "ONSITE_MARGIN_CHANGED",
      { from, to: marginPercent, reason },
      { userId, side: "STAFF" },
    );
    return { counter: next, from };
  });
}
