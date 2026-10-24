import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { NOTIFICATION_RETENTION_DAYS, purgeReadNotifications } from "../retention";
import { makeNotification, makeUser } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

describe("purgeReadNotifications", () => {
  it("purge les lues de plus de 90 jours, garde les lues récentes et toutes les non lues", async () => {
    expect(NOTIFICATION_RETENTION_DAYS).toBe(90);
    const u = await makeUser();
    const now = new Date("2026-10-24T12:00:00Z");
    const old = await makeNotification(u.id, { readAt: new Date(now.getTime() - 90 * DAY - 60_000) });
    const recent = await makeNotification(u.id, { readAt: new Date(now.getTime() - 89 * DAY) });
    const unread = await makeNotification(u.id, { createdAt: new Date(now.getTime() - 200 * DAY) });
    expect(await purgeReadNotifications(now)).toBe(1);
    const left = (await prisma.notification.findMany()).map((n) => n.id).sort();
    expect(left).toEqual([recent.id, unread.id].sort());
    expect(left).not.toContain(old.id);
  });

  it("utilise la date courante par défaut", async () => {
    const u = await makeUser();
    await makeNotification(u.id, { readAt: new Date(Date.now() - 100 * DAY) });
    expect(await purgeReadNotifications()).toBe(1);
  });
});
