import type { DemoContext, DemoEvent } from "../context";
import { prisma } from "../../../../src/lib/prisma";
import { DAY_MS, HOUR_MS, MINUTE_MS, type ShowcaseOrder } from "./helpers";
import type { Scenario } from "./scenarios";

export type Window = { start: Date; end: Date; pivot: Date | null };

/** Fenetre de vie d'une commande, bornee par la date de l'evenement et par `ctx.dates.now`. */
export function computeWindow(ctx: DemoContext, event: DemoEvent, s: Scenario): Window {
  const now = ctx.dates.now.getTime();
  const evStart = event.date.getTime();
  const evEnd = (event.endDate ?? new Date(evStart + DAY_MS)).getTime();
  let end: number;
  let start: number;
  let pivot: number | null = null;
  if (s.type === "ONSITE") {
    if (event.phase === "past") {
      end = Math.min(evEnd + DAY_MS, now - HOUR_MS);
      start = evStart - Math.min(s.span, 20) * DAY_MS;
    } else {
      end = now - s.endDaysAgo * DAY_MS;
      start = Math.max(evStart - s.span * DAY_MS, now - 9 * DAY_MS);
    }
    pivot = Math.min(evStart, end - 2 * HOUR_MS);
  } else if (event.phase === "past") {
    end = Math.min(evStart - 3 * DAY_MS, now - DAY_MS);
    start = end - Math.min(s.span, 30) * DAY_MS;
  } else {
    end = now - s.endDaysAgo * DAY_MS;
    start = Math.max(end - s.span * DAY_MS, now - 9 * DAY_MS);
  }
  if (end - start < 12 * HOUR_MS) start = end - 12 * HOUR_MS;
  if (pivot !== null && pivot <= start + HOUR_MS) pivot = null;
  return { start: new Date(start), end: new Date(end), pivot: pivot === null ? null : new Date(pivot) };
}

function spread(count: number, from: number, to: number): number[] {
  return Array.from({ length: count }, (_, i) => Math.round(from + ((to - from) * (i + 1)) / (count + 1)));
}

const detailOf = (details: unknown, key: string): unknown =>
  details && typeof details === "object" ? (details as Record<string, unknown>)[key] : undefined;

/**
 * Ramene dans le passe tout ce qu'une commande vitrine a ecrit a l'heure reelle : fil, lignes, dates
 * de la commande, paiements, mouvements de credit, planche et notifications. L'ordre de creation est
 * conserve (les horodatages sont repartis dans la fenetre) ; rien ne depasse `ctx.dates.now`.
 */
export async function retimeRequest(ctx: DemoContext, order: ShowcaseOrder, window: Window): Promise<void> {
  const { requestId } = order;
  const nowMs = ctx.dates.now.getTime();
  const startMs = window.start.getTime();
  const endMs = Math.min(window.end.getTime(), nowMs - MINUTE_MS);

  const messages = await prisma.printRequestMessage.findMany({
    where: { requestId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, eventType: true, details: true },
  });
  const times = new Map<string, number>();
  const paidIndex = messages.findIndex((m) => m.eventType === "PAYMENT_RECEIVED");
  const pivotMs = window.pivot ? Math.min(window.pivot.getTime(), endMs - 2 * HOUR_MS) : null;
  if (pivotMs !== null && paidIndex >= 0 && pivotMs > startMs + HOUR_MS) {
    const head = messages.slice(0, paidIndex + 2);
    const tail = messages.slice(paidIndex + 2);
    spread(head.length, startMs, pivotMs - HOUR_MS).forEach((t, i) => times.set(head[i].id, t));
    spread(tail.length, pivotMs, endMs).forEach((t, i) => times.set(tail[i].id, t));
  } else {
    spread(messages.length, startMs, endMs).forEach((t, i) => times.set(messages[i].id, t));
  }
  for (const m of messages) await ctx.backdate("printRequestMessage", m.id, new Date(times.get(m.id)!));

  const at = (predicate: (m: (typeof messages)[number]) => boolean, last = false): Date | null => {
    const found = last ? [...messages].reverse().find(predicate) : messages.find(predicate);
    return found ? new Date(times.get(found.id)!) : null;
  };
  const request = await prisma.printRequest.findUniqueOrThrow({ where: { id: requestId } });
  const submittedAt = request.submittedAt ? at((m) => m.eventType === "SUBMITTED") : null;
  const quotedAt = request.quotedAt ? at((m) => m.eventType === "QUOTE_SENT", true) : null;
  const acceptedAt = request.acceptedAt ? at((m) => m.eventType === "QUOTE_ACCEPTED", true) : null;
  const paidAt = request.paidAt ? at((m) => m.eventType === "PAYMENT_RECEIVED") : null;
  const completedAt = request.completedAt
    ? at((m) => m.eventType === "STATUS_CHANGED" && detailOf(m.details, "to") === "COMPLETED")
    : null;
  const cancelledAt = request.cancelledAt ? at((m) => m.eventType === "CANCELLED") : null;
  const firstAt = messages.length > 0 ? times.get(messages[0].id)! : startMs;
  const createdAt = new Date(Math.max(startMs - HOUR_MS, Math.min(firstAt, startMs) - HOUR_MS));

  await prisma.printRequest.updateMany({
    where: { id: requestId },
    data: { submittedAt, quotedAt, acceptedAt, paidAt, completedAt, cancelledAt },
  });
  await ctx.backdate("printRequest", requestId, createdAt, new Date(endMs));

  // Lignes de devis.
  const lines = await prisma.printQuoteLine.findMany({ where: { requestId }, orderBy: [{ position: "asc" }, { id: "asc" }] });
  const lineBase = (submittedAt ?? createdAt).getTime();
  for (const [i, line] of lines.entries()) {
    const t = new Date(lineBase + (line.addedBy === "ORGANIZER" ? -10 * MINUTE_MS : (5 + i) * MINUTE_MS));
    await ctx.backdate("printQuoteLine", line.id, t);
    if (line.removedAt) {
      await prisma.printQuoteLine.updateMany({ where: { id: line.id }, data: { removedAt: new Date(Math.min(endMs, t.getTime() + 2 * HOUR_MS)) } });
      await ctx.backdate("printQuoteLine", line.id, t, new Date(Math.min(endMs, t.getTime() + 2 * HOUR_MS)));
    }
  }

  // Paiements : tentatives apres l'acceptation, la reussie juste avant le passage en PAID.
  const payments = await prisma.payment.findMany({ where: { printRequestId: requestId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const from = (acceptedAt ?? new Date(startMs)).getTime();
  const until = (paidAt ?? new Date(endMs)).getTime();
  for (const [i, payment] of payments.entries()) {
    let t = from + ((until - from) * (i + 1)) / (payments.length + 1);
    if (payment.status === "PENDING") t = nowMs - 20 * MINUTE_MS;
    if (payment.status === "APPROVED" && paidAt) t = paidAt.getTime() - 2 * MINUTE_MS;
    const created = new Date(Math.round(t));
    const approvedAt = payment.status === "APPROVED" && paidAt ? new Date(paidAt.getTime() - MINUTE_MS) : null;
    if (approvedAt) await prisma.payment.updateMany({ where: { id: payment.id }, data: { approvedAt } });
    await ctx.backdate("payment", payment.id, created, approvedAt ?? created);
  }

  // Mouvements de credit.
  const credits = await prisma.orgPrintCredit.findMany({ where: { requestId } });
  for (const credit of credits) {
    const t = credit.kind === "EARNED" ? (completedAt ?? new Date(endMs)) : (paidAt ?? new Date(endMs));
    await ctx.backdate("orgPrintCredit", credit.id, t);
  }

  // Planche liee a la commande.
  const generation = await prisma.printSheetGeneration.findUnique({ where: { printRequestId: requestId } });
  if (generation) {
    const t = at((m) => m.eventType === "SHEETS_GENERATED", true) ?? new Date(endMs);
    await ctx.backdate("printSheetGeneration", generation.id, t);
  }

  // Notifications liees a la commande (groupees par lot d'envoi), puis commande suivante : meme repartition.
  const notifications = await prisma.notification.findMany({
    where: { href: { contains: requestId } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, createdAt: true },
  });
  const groups = [...new Set(notifications.map((n) => n.createdAt.getTime()))];
  const groupTimes = spread(groups.length, (submittedAt ?? new Date(startMs)).getTime(), endMs);
  const byGroup = new Map(groups.map((g, i) => [g, groupTimes[i]]));
  for (const n of notifications) await ctx.backdate("notification", n.id, new Date(byGroup.get(n.createdAt.getTime())!));
}

/** Horodatages d'une commande complementaire creee a la cloture (apres la commande mere). */
export async function retimeSupplement(ctx: DemoContext, childId: string, at: Date): Promise<void> {
  const t = Math.min(at.getTime() + HOUR_MS, ctx.dates.now.getTime() - MINUTE_MS);
  const date = new Date(t);
  await prisma.printRequest.updateMany({ where: { id: childId }, data: { submittedAt: date, quotedAt: date } });
  await ctx.backdate("printRequest", childId, date, date);
  const messages = await prisma.printRequestMessage.findMany({ where: { requestId: childId }, select: { id: true } });
  for (const m of messages) await ctx.backdate("printRequestMessage", m.id, date);
  const lines = await prisma.printQuoteLine.findMany({ where: { requestId: childId }, select: { id: true } });
  for (const l of lines) await ctx.backdate("printQuoteLine", l.id, date);
}
