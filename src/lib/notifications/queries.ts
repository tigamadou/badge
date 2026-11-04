import type { Notification, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { NotificationScopeRef } from "./scope";
import type { NotificationDTO, NotificationLink } from "./types";

export const NOTIFICATIONS_PAGE_SIZE = 20;

export class InvalidCursorError extends Error {}

// Portée par espace (spec 24) : l'espace org montre aussi les notifications d'évènement
// de cette org (orgId est toujours renseigné sur une notification d'évènement).
export function scopeWhere(userId: string, ref: NotificationScopeRef): Prisma.NotificationWhereInput {
  switch (ref.kind) {
    case "platform":
      return { userId, scope: "PLATFORM" };
    case "org":
      return { userId, orgId: ref.orgId, scope: { in: ["ORG", "EVENT"] } };
    case "event":
      return { userId, eventId: ref.eventId, scope: "EVENT" };
    case "participant":
      return { userId, scope: "PARTICIPANT" };
  }
}

function isLink(value: unknown): value is NotificationLink {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.label === "string" && typeof v.href === "string";
}

function sanitizeLink(l: NotificationLink): NotificationLink {
  const out: NotificationLink = { label: l.label, href: l.href };
  if (typeof l.anchor === "string" && l.anchor !== "") out.anchor = l.anchor;
  return out;
}

export function toNotificationDTO(n: Notification): NotificationDTO {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    href: n.href,
    links: Array.isArray(n.links) ? n.links.filter(isLink).map(sanitizeLink) : [],
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function listNotifications(
  userId: string,
  ref: NotificationScopeRef,
  opts: { cursor?: string; unreadOnly?: boolean; limit?: number } = {},
): Promise<{ items: NotificationDTO[]; nextCursor: string | null }> {
  const limit = opts.limit ?? NOTIFICATIONS_PAGE_SIZE;
  const where = scopeWhere(userId, ref);
  if (opts.cursor) {
    const owned = await prisma.notification.findFirst({
      where: { ...where, id: opts.cursor },
      select: { id: true },
    });
    if (!owned) throw new InvalidCursorError("Curseur invalide.");
  }
  const rows = await prisma.notification.findMany({
    where: opts.unreadOnly ? { ...where, readAt: null } : where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(toNotificationDTO),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  };
}

export function countUnread(userId: string, ref: NotificationScopeRef): Promise<number> {
  return prisma.notification.count({ where: { ...scopeWhere(userId, ref), readAt: null } });
}

// false si la notification n'existe pas ou appartient à un autre utilisateur. Idempotent.
export async function markRead(userId: string, id: string): Promise<boolean> {
  const owned = await prisma.notification.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) return false;
  await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  return true;
}

export async function markAllRead(userId: string, ref: NotificationScopeRef): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { ...scopeWhere(userId, ref), readAt: null },
    data: { readAt: new Date() },
  });
  return count;
}
