import { randomUUID } from "node:crypto";
import type { PrintDelivery, PrintRequestStatus, Prisma } from "@prisma/client";
import { prisma } from "../../../../src/lib/prisma";
import { snapshotEventTemplate } from "../../../../src/lib/print-requests/service";
import { describeThreadEvent, type ThreadEventType } from "../../../../src/lib/print-requests/thread";
import { insertInBatches, type DemoContext, type DemoEvent, type DemoOrg, type DemoUser } from "../context";
import { DAY_MS, FEDAPAY_ID_END, HOUR_MS, MINUTE_MS, pick, type PrintState, type VolumeOrder } from "./helpers";
import { ownerFor } from "./orders";
import type { Scenario } from "./scenarios";
import { computeWindow } from "./timeline";

const STATUS_WEIGHTS: Array<[PrintRequestStatus, number]> = [
  ["COMPLETED", 28], ["PAID", 14], ["IN_PRODUCTION", 8], ["READY", 8], ["ACCEPTED", 6],
  ["QUOTED", 8], ["SUBMITTED", 10], ["CANCELLED", 6], ["REJECTED", 5], ["DRAFT", 4],
];
const NON_RESERVING = new Set<PrintRequestStatus>(["DRAFT", "REJECTED", "CANCELLED"]);
const PIN_HOLDING = new Set<PrintRequestStatus>(["ACCEPTED", "PAID", "IN_PRODUCTION", "READY"]);
const REJECT_REASONS = [
  "Le visuel fourni ne respecte pas la zone de sécurité du badge.",
  "Délai trop court pour la date souhaitée.",
  "Quantité inférieure au minimum de production.",
];
const OFFLINE_REASON = "Virement reçu — rapprochement manuel";
const QUESTIONS = [
  "Bonjour, pouvez-vous confirmer le délai de production pour cette commande ?",
  "Bonjour, est-il possible d'ajouter quelques badges avant le démarrage de la production ?",
  "Bonsoir, le visuel du badge sera-t-il identique à la maquette validée ?",
];
const ANSWERS = [
  "Bonjour, comptez cinq jours ouvrés après l'acceptation du devis.",
  "Bonjour, oui tant que la production n'a pas démarré. Mettez la commande à jour et nous ajusterons le devis.",
  "Bonjour, oui, le visuel est repris à l'identique de la maquette.",
]; 

type Step = { type: ThreadEventType | "MESSAGE"; at: Date; details: Record<string, unknown>; actor: "OWNER" | "STAFF" | "SYSTEM" };

function weighted(ctx: DemoContext): PrintRequestStatus {
  const total = STATUS_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  let roll = ctx.faker.number.int({ min: 1, max: total });
  for (const [status, weight] of STATUS_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return status;
  }
  return "SUBMITTED";
}

async function nextReferenceNumber(year: number): Promise<number> {
  const prefix = `IMP-${year}-`;
  const rows = await prisma.printRequest.findMany({ where: { reference: { startsWith: prefix } }, select: { reference: true } });
  let max = 0;
  for (const { reference } of rows) {
    const n = Number(reference.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max + 1;
}

/** Commandes de volume ecrites par lots (aucune fonction du domaine) : listes, filtres et pagination. */
export async function seedVolumeOrders(ctx: DemoContext, state: PrintState): Promise<void> {
  const year = ctx.dates.now.getUTCFullYear();
  let seq = await nextReferenceNumber(year);
  const perEvent = Math.max(1, Math.round(6 * ctx.scale));
  const templateCache = new Map<string, Awaited<ReturnType<typeof snapshotEventTemplate>> | null>();
  const staffAdmin = state.staffAdmin;
  const staffSupport = state.staffSupport;

  const requests: Prisma.PrintRequestCreateManyInput[] = [];
  const items: Prisma.PrintRequestItemCreateManyInput[] = [];
  const lines: Prisma.PrintQuoteLineCreateManyInput[] = [];
  const messages: Prisma.PrintRequestMessageCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const reads: Prisma.PrintRequestReadCreateManyInput[] = [];

  const orgs: Array<{ org: DemoOrg; mult: number }> = [
    ...ctx.registry.orgsBySize.huge.map((org) => ({ org, mult: 2 })),
    ...ctx.registry.orgsBySize.medium.map((org) => ({ org, mult: 1 })),
  ].filter((o) => !o.org.archived);

  for (const { org, mult } of orgs) {
    const owner = await ownerFor(ctx, state, org);
    const events = (ctx.registry.eventsByOrg.get(org.id) ?? []).filter((e) => !e.archived);
    for (const event of events) {
      let template = templateCache.get(event.id);
      if (template === undefined) {
        template = await snapshotEventTemplate(event.id).catch(() => null);
        templateCache.set(event.id, template);
      }
      if (!template) continue;
      const claimed = state.claimed.get(event.id) ?? new Set<string>();
      state.claimed.set(event.id, claimed);
      const free = ctx.faker.helpers.shuffle(
        (ctx.registry.registrations.get(event.id)?.APPROVED ?? []).filter((r) => !claimed.has(r.id)),
      );
      for (let k = 0; k < perEvent * mult; k++) {
        if (free.length < 3) break;
        const status = weighted(ctx);
        const quantity = Math.min(free.length, ctx.faker.number.int({ min: 4, max: 45 }));
        const regs = NON_RESERVING.has(status) ? free.slice(0, quantity) : free.splice(0, quantity);
        if (!NON_RESERVING.has(status)) for (const r of regs) claimed.add(r.id);
        const row = buildOrder(ctx, state, { org, event, owner, staffAdmin, staffSupport, status, quantity: regs.length, template, seq: seq++ });
        requests.push(row.request);
        items.push(...regs.map((r, i) => ({ requestId: row.request.id as string, registrationId: r.id, position: i, createdAt: row.request.createdAt as Date })));
        lines.push(...row.lines);
        messages.push(...row.messages);
        payments.push(...row.payments);
        reads.push(...row.reads);
        state.volume.push(row.summary);
      }
    }
  }

  await insertInBatches(requests, (chunk) => prisma.printRequest.createMany({ data: chunk }));
  await insertInBatches(items, (chunk) => prisma.printRequestItem.createMany({ data: chunk }));
  await insertInBatches(lines, (chunk) => prisma.printQuoteLine.createMany({ data: chunk }));
  await insertInBatches(messages, (chunk) => prisma.printRequestMessage.createMany({ data: chunk }));
  await insertInBatches(payments, (chunk) => prisma.payment.createMany({ data: chunk }));
  await insertInBatches(reads, (chunk) => prisma.printRequestRead.createMany({ data: chunk }));
  console.log(`[seed demo] impression / volume : ${requests.length} commandes, ${messages.length} entrees de fil, ${payments.length} paiements`);
}

type BuildInput = {
  org: DemoOrg;
  event: DemoEvent;
  owner: DemoUser;
  staffAdmin: DemoUser;
  staffSupport: DemoUser;
  status: PrintRequestStatus;
  quantity: number;
  template: NonNullable<Awaited<ReturnType<typeof snapshotEventTemplate>>>;
  seq: number;
};

function buildOrder(ctx: DemoContext, state: PrintState, input: BuildInput) {
  const { org, event, owner, status, quantity, template } = input;
  const id = randomUUID();
  const year = ctx.dates.now.getUTCFullYear();
  const reference = `IMP-${year}-${String(input.seq).padStart(4, "0")}`;
  const staff = ctx.faker.datatype.boolean() ? input.staffAdmin : input.staffSupport;

  // Fenetre de vie et pas du cycle atteints par le statut.
  const window = computeWindow(ctx, event, { type: "ADVANCE", span: ctx.faker.number.int({ min: 4, max: 24 }), endDaysAgo: ctx.faker.number.float({ min: 0.3, max: 8 }) } as Scenario);
  const endsFrom = status === "CANCELLED" || status === "REJECTED" ? (ctx.faker.datatype.boolean() ? "QUOTED" : "SUBMITTED") : null;
  const quoted = ["QUOTED", "ACCEPTED", "PAID", "IN_PRODUCTION", "READY", "COMPLETED"].includes(status) || endsFrom === "QUOTED";
  const accepted = ["ACCEPTED", "PAID", "IN_PRODUCTION", "READY", "COMPLETED"].includes(status);
  const paid = ["PAID", "IN_PRODUCTION", "READY", "COMPLETED"].includes(status);
  const offline = paid && ctx.faker.number.int({ min: 1, max: 10 }) <= 3;
  const failedAttempt = status === "ACCEPTED" && ctx.faker.number.int({ min: 1, max: 10 }) <= 3;

  // Lignes de devis.
  const badge = pick(state.products.badge, input.seq);
  const lineRows: Prisma.PrintQuoteLineCreateManyInput[] = [];
  const addLine = (kind: "PRODUCT" | "SERVICE" | "CUSTOM", label: string, qty: number, unit: number, by: "ORGANIZER" | "STAFF", productId: string | null) => {
    lineRows.push({
      id: randomUUID(), requestId: id, kind, productId, label, quantity: qty, unitPrice: unit, lineTotal: qty * unit,
      position: lineRows.length, addedBy: by, createdAt: window.start, updatedAt: window.start,
    });
  };
  addLine("PRODUCT", badge.name, quantity, badge.basePrice, "ORGANIZER", badge.id);
  if (ctx.faker.number.int({ min: 1, max: 100 }) <= 35 && state.products.accessories.length > 0) {
    const accessory = pick(state.products.accessories, input.seq);
    addLine("PRODUCT", accessory.name, Math.max(accessory.minQuantity, quantity), accessory.basePrice, "ORGANIZER", accessory.id);
  }
  if (quoted && ctx.faker.number.int({ min: 1, max: 100 }) <= 25) addLine("SERVICE", "Livraison express", 1, 7500, "STAFF", null);
  if (quoted && ctx.faker.number.int({ min: 1, max: 100 }) <= 10) addLine("CUSTOM", "Impression du verso en couleur", 1, 12000, "STAFF", null);
  const total = lineRows.reduce((sum, l) => sum + l.lineTotal, 0);

  // Fil : etapes reparties sur la fenetre, dans l'ordre du cycle.
  const kinds: Array<{ type: ThreadEventType | "MESSAGE"; details: Record<string, unknown>; actor: Step["actor"] }> = [];
  if (status !== "DRAFT") kinds.push({ type: "SUBMITTED", details: { badgeCount: quantity, total }, actor: "OWNER" });
  const exchange = status !== "DRAFT" && ctx.faker.number.int({ min: 1, max: 100 }) <= 28;
  const question = pick(QUESTIONS, input.seq);
  const answer = pick(ANSWERS, input.seq);
  if (exchange) {
    kinds.push({ type: "MESSAGE", details: { body: question }, actor: "OWNER" });
    kinds.push({ type: "MESSAGE", details: { body: answer }, actor: "STAFF" });
  }
  if (quoted) kinds.push({ type: "QUOTE_SENT", details: { version: 1, total }, actor: "STAFF" });
  if (accepted) kinds.push({ type: "QUOTE_ACCEPTED", details: { version: 1, total }, actor: "OWNER" });
  const paymentId = randomUUID();
  if (failedAttempt) kinds.push({ type: "PAYMENT_FAILED", details: { amount: total, paymentId, reason: "declined" }, actor: "SYSTEM" });
  if (paid) {
    kinds.push({
      type: "PAYMENT_RECEIVED",
      details: offline ? { amount: total, reason: OFFLINE_REASON } : { amount: total, paymentId },
      actor: offline ? "STAFF" : "SYSTEM",
    });
  }
  const afterPaid: Array<[PrintRequestStatus, PrintRequestStatus]> = [["PAID", "IN_PRODUCTION"], ["IN_PRODUCTION", "READY"], ["READY", "COMPLETED"]];
  const reach = ["IN_PRODUCTION", "READY", "COMPLETED"].indexOf(status);
  for (let i = 0; i <= reach; i++) kinds.push({ type: "STATUS_CHANGED", details: { from: afterPaid[i][0], to: afterPaid[i][1] }, actor: "STAFF" });
  if (status === "CANCELLED") kinds.push({ type: "CANCELLED", details: {}, actor: "OWNER" });
  if (status === "REJECTED") kinds.push({ type: "REJECTED", details: { reason: pick(REJECT_REASONS, input.seq) }, actor: "STAFF" });

  const startMs = window.start.getTime();
  const endMs = Math.min(window.end.getTime(), ctx.dates.now.getTime() - MINUTE_MS);
  const steps: Step[] = kinds.map((k, i) => ({ ...k, at: new Date(Math.round(startMs + ((endMs - startMs) * (i + 1)) / (kinds.length + 1))) }));
  const at = (type: ThreadEventType | "MESSAGE", last = false): Date | null => {
    const found = last ? [...steps].reverse().find((s) => s.type === type) : steps.find((s) => s.type === type);
    return found?.at ?? null;
  };

  const authorOf = (actor: Step["actor"]) => (actor === "OWNER" ? owner.id : actor === "STAFF" ? staff.id : null);
  const sideOf = (actor: Step["actor"]) => (actor === "OWNER" ? "ORGANIZER" : actor === "STAFF" ? "STAFF" : "SYSTEM");
  const messageRows: Prisma.PrintRequestMessageCreateManyInput[] = steps.map((s) =>
    s.type === "MESSAGE"
      ? { id: randomUUID(), requestId: id, authorId: authorOf(s.actor), side: sideOf(s.actor), kind: "MESSAGE", body: s.details.body as string, internal: false, createdAt: s.at, updatedAt: s.at }
      : {
          id: randomUUID(), requestId: id, authorId: authorOf(s.actor), side: sideOf(s.actor), kind: "EVENT",
          body: describeThreadEvent(s.type, s.details), eventType: s.type, details: s.details as Prisma.InputJsonValue,
          internal: false, createdAt: s.at, updatedAt: s.at,
        },
  );
  const exchanges = steps
    .filter((s) => s.type === "MESSAGE")
    .map((s) => ({ authorName: s.actor === "OWNER" ? owner.name : staff.name, body: s.details.body as string, toStaff: s.actor === "OWNER", at: s.at }));

  // Paiements en ligne.
  const paymentRows: Prisma.PaymentCreateManyInput[] = [];
  const nextFedapay = () => {
    const value = state.fedapaySeq++;
    if (value > FEDAPAY_ID_END) throw new Error("Plage d'identifiants FedaPay de demo epuisee");
    return value;
  };
  if (failedAttempt) {
    const t = at("PAYMENT_FAILED")!;
    const tid = nextFedapay();
    paymentRows.push({
      id: paymentId, orgId: org.id, purpose: "PRINT_REQUEST", printRequestId: id, userId: owner.id, amount: total, currency: "XOF",
      status: "DECLINED", fedapayTransactionId: tid, fedapayReference: `demo-fedapay-${tid}`, createdAt: t, updatedAt: t,
    });
  }
  let paidPaymentId: string | null = null;
  if (paid && !offline) {
    const t = at("PAYMENT_RECEIVED")!;
    const tid = nextFedapay();
    paidPaymentId = paymentId;
    paymentRows.push({
      id: paymentId, orgId: org.id, purpose: "PRINT_REQUEST", printRequestId: id, userId: owner.id, amount: total, currency: "XOF",
      status: "APPROVED", fedapayTransactionId: tid, fedapayReference: `demo-fedapay-${tid}`,
      approvedAt: new Date(t.getTime() - MINUTE_MS), createdAt: new Date(t.getTime() - 2 * MINUTE_MS), updatedAt: t,
    });
  }

  const delivery: PrintDelivery = ctx.faker.datatype.boolean() ? "PICKUP" : "DELIVERY";
  const submittedAt = at("SUBMITTED");
  const quotedAt = at("QUOTE_SENT", true);
  const acceptedAt = at("QUOTE_ACCEPTED", true);
  const createdAt = new Date(startMs - HOUR_MS);
  const endAt = steps.length > 0 ? steps[steps.length - 1].at : window.start;

  const request: Prisma.PrintRequestCreateManyInput = {
    id, reference, eventId: event.id, orgId: org.id, type: "ADVANCE", status, createdById: owner.id,
    badgeTemplateId: template.badgeTemplateId, badgeWidthPx: template.badgeWidthPx, badgeHeightPx: template.badgeHeightPx,
    badgePages: template.badgePages, templatePinned: PIN_HOLDING.has(status),
    delivery, deliveryAddress: delivery === "DELIVERY" ? `${ctx.faker.location.streetAddress()}, ${ctx.faker.location.city()}` : null,
    deliveryContactName: ctx.faker.person.fullName(), deliveryContactPhone: ctx.faker.phone.number({ style: "international" }),
    wantedBy: new Date(Math.max(event.date.getTime() - 4 * DAY_MS, endAt.getTime() + DAY_MS)),
    estimatedQuantity: quantity,
    notes: ctx.faker.number.int({ min: 1, max: 4 }) === 1 ? "Merci de prévoir un emballage par lot de 50 badges." : null,
    quoteVersion: quoted ? 1 : 0,
    acceptedVersion: accepted ? 1 : null, acceptedTotal: accepted ? total : null, acceptedAt: accepted ? acceptedAt : null,
    acceptedById: accepted ? owner.id : null,
    total, submittedAt, quotedAt: quoted ? quotedAt : null,
    paidAt: paid ? at("PAYMENT_RECEIVED") : null, paidPaymentId,
    completedAt: status === "COMPLETED" ? at("STATUS_CHANGED", true) : null,
    cancelledAt: status === "CANCELLED" ? at("CANCELLED") : null,
    createdAt, updatedAt: endAt,
  };

  // Lecture : la plupart des fils sont lus ; quelques-uns restent non lus.
  const readRows: Prisma.PrintRequestReadCreateManyInput[] = [];
  if (steps.length > 0 && ctx.faker.number.int({ min: 1, max: 100 }) <= 88) {
    for (const reader of new Set([owner, state.staffAdmin, state.staffSupport].map((u) => u.id))) {
      readRows.push({ id: randomUUID(), requestId: id, userId: reader, lastReadAt: new Date(endAt.getTime() + 5 * MINUTE_MS < ctx.dates.now.getTime() ? endAt.getTime() + 5 * MINUTE_MS : endAt.getTime()) });
    }
  }

  const summary: VolumeOrder = {
    id, reference, orgId: org.id, orgName: org.name, eventId: event.id, eventTitle: event.title, status, badgeCount: quantity,
    total, quoteVersion: request.quoteVersion as number, submittedAt, quotedAt: quoted ? quotedAt : null, endAt, exchanges,
  };
  return { request, lines: lineRows, messages: messageRows, payments: paymentRows, reads: readRows, summary };
}
