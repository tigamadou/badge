import { randomUUID } from "node:crypto";
import type { ActivityType, NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../../../../src/lib/prisma";
import {
  printRequestMessageMessage, printRequestQuotedMessage, printRequestStatusChangedMessage, printRequestSubmittedMessage,
} from "../../../../src/lib/notifications/messages";
import type { NotificationContent } from "../../../../src/lib/notifications/types";
import { DEMO_SLUG_PREFIX } from "../../constants";
import { insertInBatches, type DemoContext, type DemoUser } from "../context";
import { DAY_MS, HOUR_MS, MINUTE_MS, demoProductWhere, LAYOUT_NAME_MATCH, type PrintState } from "./helpers";

const FIVE_YEARS_MS = 5 * 365 * DAY_MS;

const ACTIVITY_BY_EVENT: Record<string, ActivityType> = {
  SUBMITTED: "PRINT_REQUEST_SUBMITTED",
  REQUEST_UPDATED: "PRINT_REQUEST_UPDATED",
  LINES_CHANGED: "PRINT_REQUEST_UPDATED",
  QUOTE_SENT: "PRINT_REQUEST_QUOTED",
  QUOTE_ACCEPTED: "PRINT_REQUEST_ACCEPTED",
  QUOTE_REOPENED: "PRINT_REQUEST_REOPENED",
  STATUS_CHANGED: "PRINT_REQUEST_STATUS_CHANGED",
  CANCELLED: "PRINT_REQUEST_CANCELLED",
  REJECTED: "PRINT_REQUEST_REJECTED",
  ONSITE_MARGIN_CHANGED: "PRINT_REQUEST_MARGIN_RAISED",
  ORG_CREDIT_APPLIED: "PRINT_CREDIT_APPLIED",
  ONSITE_CREDIT_EARNED: "PRINT_CREDIT_EARNED",
  ONSITE_SUPPLEMENT_CREATED: "PRINT_REQUEST_SUPPLEMENT_CREATED",
};

function before(ctx: DemoContext, date: Date): Date {
  return date.getTime() < ctx.dates.now.getTime() ? date : new Date(ctx.dates.now.getTime() - MINUTE_MS);
}

/** Une ligne de journal par transition du fil (commandes vitrine et volume), datee de l'entree de fil. */
async function orderActivity(ctx: DemoContext, orgIds: string[]): Promise<Prisma.ActivityLogCreateManyInput[]> {
  const staffIds = new Set(Object.values(ctx.registry.staff).flat().map((u) => u.id));
  const rows = await prisma.printRequestMessage.findMany({
    where: { kind: "EVENT", request: { orgId: { in: orgIds } } },
    select: {
      id: true, eventType: true, details: true, authorId: true, createdAt: true,
      request: { select: { id: true, reference: true, orgId: true, eventId: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const out: Prisma.ActivityLogCreateManyInput[] = [];
  for (const m of rows) {
    const details = (m.details && typeof m.details === "object" ? m.details : {}) as Record<string, unknown>;
    let type = m.eventType ? ACTIVITY_BY_EVENT[m.eventType] : undefined;
    if (m.eventType === "PAYMENT_RECEIVED" && typeof details.reason === "string") type = "PRINT_REQUEST_MARKED_PAID";
    if (!type) continue;
    out.push({
      id: randomUUID(), type, userId: m.authorId, orgId: m.request.orgId, eventId: m.request.eventId, targetId: m.request.id,
      details: { reference: m.request.reference, ...details } as Prisma.InputJsonValue,
      staffActor: m.authorId !== null && staffIds.has(m.authorId), createdAt: before(ctx, m.createdAt),
    });
  }
  return out;
}

/** Journal du catalogue, des gabarits et des generations libres (celles des commandes ont deja le leur). */
async function catalogActivity(ctx: DemoContext, state: PrintState): Promise<Prisma.ActivityLogCreateManyInput[]> {
  const out: Prisma.ActivityLogCreateManyInput[] = [];
  const staff = state.staffAdmin;
  const entry = (type: ActivityType, targetId: string, createdAt: Date, details: Prisma.InputJsonValue, userId = staff.id) =>
    out.push({ id: randomUUID(), type, userId, targetId, details, staffActor: false, createdAt: before(ctx, createdAt) });

  const products = await prisma.printProduct.findMany({ where: demoProductWhere, orderBy: { createdAt: "asc" } });
  for (const [i, p] of products.entries()) {
    entry("PRINT_PRODUCT_CREATED", p.id, p.createdAt, { name: p.name, kind: p.kind });
    if (p.published && i % 2 === 0) entry("PRINT_PRODUCT_UPDATED", p.id, new Date(p.createdAt.getTime() + 3 * DAY_MS), { name: p.name, fields: ["basePrice"] });
    if (p.archived) entry("PRINT_PRODUCT_ARCHIVED", p.id, p.archivedAt ?? new Date(p.createdAt.getTime() + 10 * DAY_MS), { name: p.name });
  }
  const layouts = await prisma.printSheetLayout.findMany({ where: { name: { startsWith: LAYOUT_NAME_MATCH } }, orderBy: { createdAt: "asc" } });
  for (const [i, l] of layouts.entries()) {
    entry("PRINT_LAYOUT_CREATED", l.id, l.createdAt, { name: l.name });
    if (i === 0) entry("PRINT_LAYOUT_UPDATED", l.id, new Date(l.createdAt.getTime() + 2 * DAY_MS), { name: l.name });
    if (l.archived) entry("PRINT_LAYOUT_ARCHIVED", l.id, l.archivedAt ?? new Date(l.createdAt.getTime() + 5 * DAY_MS), { name: l.name });
  }
  const free = await prisma.printSheetGeneration.findMany({ where: { printRequestId: null, createdById: { not: null }, event: { organization: { slug: { startsWith: DEMO_SLUG_PREFIX } } } }, include: { event: { select: { orgId: true } } } });
  for (const g of free) {
    out.push({
      id: randomUUID(), type: "PRINT_SHEETS_GENERATED", userId: g.createdById, orgId: g.event.orgId, eventId: g.eventId, targetId: g.id,
      details: { eventId: g.eventId, badgeCount: g.badgeCount, layoutId: g.layoutId }, staffActor: true, createdAt: before(ctx, g.createdAt),
    });
  }
  return out;
}

type Recipient = { user: DemoUser; scope: "PLATFORM" | "EVENT" };

function readAt(ctx: DemoContext, createdAt: Date): Date | null {
  const ageDays = (ctx.dates.now.getTime() - createdAt.getTime()) / DAY_MS;
  const probability = ageDays > 5 ? 0.85 : 0.3;
  if (ctx.faker.number.float({ min: 0, max: 1 }) > probability) return null;
  const at = new Date(createdAt.getTime() + ctx.faker.number.int({ min: 10, max: 600 }) * MINUTE_MS);
  return before(ctx, at);
}

/** Notifications des commandes de volume ; les jobs d'email du module sont ensuite pares par l'appelant. */
async function volumeNotifications(ctx: DemoContext, state: PrintState): Promise<number> {
  const staffAdmins = [...new Map([...ctx.registry.staff.SUPER_ADMIN, ...ctx.registry.staff.STAFF_ADMIN].map((u) => [u.id, u])).values()];
  const notifications: Prisma.NotificationCreateManyInput[] = [];
  const jobs: Prisma.JobCreateManyInput[] = [];
  const parkedAt = new Date(ctx.dates.now.getTime() + FIVE_YEARS_MS);

  const push = (type: NotificationType, recipients: Recipient[], order: (typeof state.volume)[number], content: NotificationContent, createdAt: Date) => {
    const at = before(ctx, createdAt);
    for (const r of recipients) {
      notifications.push({
        id: randomUUID(), userId: r.user.id, type, scope: r.scope, orgId: order.orgId, eventId: order.eventId,
        title: content.title, body: content.body, href: content.href,
        links: [{ label: content.primaryLabel, href: content.href }, ...content.links],
        readAt: readAt(ctx, at), createdAt: at,
      });
    }
  };
  const eventAdmins = (order: (typeof state.volume)[number]): Recipient[] => {
    const admins = ctx.registry.eventMembers.get(order.eventId)?.ADMIN ?? [];
    const owners = ctx.registry.orgMembers.get(order.orgId)?.OWNER ?? [];
    return (admins.length > 0 ? admins : owners).slice(0, 2).map((user) => ({ user, scope: "EVENT" as const }));
  };
  const staffRecipients = staffAdmins.map((user) => ({ user, scope: "PLATFORM" as const }));

  for (const order of state.volume) {
    if (order.status === "DRAFT" || !order.submittedAt) continue;
    push("PRINT_REQUEST_SUBMITTED", staffRecipients, order, printRequestSubmittedMessage({
      requestId: order.id, reference: order.reference, eventTitle: order.eventTitle, orgName: order.orgName, type: "ADVANCE", badgeCount: order.badgeCount,
    }), order.submittedAt);

    for (const x of order.exchanges) {
      push("PRINT_REQUEST_MESSAGE", x.toStaff ? staffRecipients : eventAdmins(order), order, printRequestMessageMessage({
        requestId: order.id, eventId: order.eventId, reference: order.reference, authorName: x.authorName, body: x.body, toStaff: x.toStaff,
      }), x.at);
    }
    if (order.quotedAt) {
      const recipients = eventAdmins(order);
      push("PRINT_REQUEST_QUOTED", recipients, order, printRequestQuotedMessage({
        requestId: order.id, eventId: order.eventId, reference: order.reference, eventTitle: order.eventTitle, version: order.quoteVersion, total: order.total,
      }), order.quotedAt);
      const first = recipients[0];
      if (first) {
        const done = ctx.faker.number.int({ min: 1, max: 10 }) <= 7;
        const at = before(ctx, order.quotedAt);
        jobs.push({
          id: randomUUID(), type: "EMAIL", kind: "notification.print_request_quoted", recipient: first.user.email,
          status: done ? "SUCCEEDED" : "PENDING", attempts: done ? 1 : 0,
          payload: { to: first.user.email, subject: "Devis d'impression disponible", html: done ? "" : "<p>Le devis de votre commande d'impression est disponible.</p>", kind: "notification.print_request_quoted", ctx: { eventId: order.eventId, orgId: order.orgId } },
          runAt: done ? at : parkedAt, completedAt: done ? new Date(at.getTime() + MINUTE_MS) : null, createdAt: at, updatedAt: at,
        });
      }
    }
    if (["IN_PRODUCTION", "READY", "COMPLETED", "REJECTED"].includes(order.status)) {
      push("PRINT_REQUEST_STATUS_CHANGED", eventAdmins(order), order, printRequestStatusChangedMessage({
        requestId: order.id, eventId: order.eventId, reference: order.reference, eventTitle: order.eventTitle, status: order.status as never, toStaff: false,
      }), new Date(order.endAt.getTime() + HOUR_MS / 2));
    } else if (order.status === "CANCELLED") {
      push("PRINT_REQUEST_STATUS_CHANGED", staffRecipients, order, printRequestStatusChangedMessage({
        requestId: order.id, eventId: order.eventId, reference: order.reference, eventTitle: order.eventTitle, status: "CANCELLED", toStaff: true,
      }), order.endAt);
    }
  }
  await insertInBatches(notifications, (chunk) => prisma.notification.createMany({ data: chunk }));
  await insertInBatches(jobs, (chunk) => prisma.job.createMany({ data: chunk }));
  return notifications.length;
}

export async function seedPrintActivity(ctx: DemoContext, state: PrintState): Promise<void> {
  const orgs = await prisma.organization.findMany({ where: { slug: { startsWith: DEMO_SLUG_PREFIX } }, select: { id: true } });
  const logs = [...(await orderActivity(ctx, orgs.map((o) => o.id))), ...(await catalogActivity(ctx, state))];
  await insertInBatches(logs, (chunk) => prisma.activityLog.createMany({ data: chunk }));
  const notified = await volumeNotifications(ctx, state);
  console.log(`[seed demo] impression / journal : ${logs.length} lignes, ${notified} notifications de volume`);
}

/** Aucun job du module ne doit partir : le worker de dev enverrait de vrais emails. */
export async function parkAllPrintJobs(ctx: DemoContext, state: PrintState): Promise<number> {
  return ctx.parkJobs(state.startedAt);
}
