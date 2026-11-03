import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import type { DemoContext } from "../../context";
import { seedBilling } from "../../billing";
import { seedNotificationsAndActivity } from "../../notifications";
import { buildWorld, teardownWorld } from "../../billing/__tests__/helpers";

const DAY_MS = 86_400_000;

describe("lot 2b de bout en bout", () => {
  let ctx: DemoContext;

  async function run() {
    await seedBilling(ctx);
    await seedNotificationsAndActivity(ctx);
  }
  const counts = async () => [
    await prisma.plan.count(), await prisma.subscription.count(), await prisma.subscriptionReminder.count(),
    await prisma.payment.count(), await prisma.job.count(), await prisma.notification.count(), await prisma.activityLog.count(),
  ];

  beforeEach(async () => {
    ({ ctx } = await buildWorld());
  });
  afterEach(() => teardownWorld(ctx));

  it("garde les invariants du lot apres deux executions successives", async () => {
    await run();
    const first = await counts();
    await run();
    expect(await counts()).toEqual(first);

    const now = ctx.dates.now.getTime();
    const wall = Date.now();

    // Aucun abonnement actif sans paiement approuve (hors plan sans prix).
    for (const s of await prisma.subscription.findMany({ where: { status: "ACTIVE" }, include: { plan: true } })) {
      if (s.plan.price !== null) {
        expect(await prisma.payment.count({ where: { orgId: s.orgId, status: "APPROVED" } })).toBeGreaterThan(0);
      }
      expect(s.endDate === null || s.endDate.getTime() > now).toBe(true);
    }

    // Aucun job executable par le worker.
    for (const j of await prisma.job.findMany({ where: { status: { in: ["PENDING", "RUNNING"] } } })) {
      expect(j.runAt.getTime()).toBeGreaterThan(now + 365 * DAY_MS);
      if (j.status === "RUNNING") expect(j.lockedAt!.getTime()).toBeGreaterThan(now + 365 * DAY_MS);
    }

    // Aucun paiement PENDING avec transaction.
    expect(await prisma.payment.count({ where: { status: "PENDING", fedapayTransactionId: { not: null } } })).toBe(0);

    // Rien dans le futur (hors echeances, runAt, lockedAt).
    expect(await prisma.payment.count({ where: { createdAt: { gt: new Date(wall) } } })).toBe(0);
    expect(await prisma.notification.count({ where: { createdAt: { gt: new Date(wall) } } })).toBe(0);
    expect(await prisma.activityLog.count({ where: { createdAt: { gt: new Date(wall) } } })).toBe(0);
    expect(await prisma.subscriptionReminder.count({ where: { sentAt: { gt: new Date(now) } } })).toBe(0);
    expect(await prisma.job.count({ where: { status: { in: ["SUCCEEDED", "FAILED", "CANCELLED"] }, completedAt: { gt: new Date(wall) } } })).toBe(0);
  });

  it("n'appelle aucun service externe : pas d'export, de courrier ni de job issu d'un envoi", async () => {
    const { fakeExporter } = await import("@/lib/__tests__/helpers/fake-exporter");
    const before = fakeExporter.calls.length; // le socle (modeles de badge) en a deja fait
    await run();
    expect(fakeExporter.calls).toHaveLength(before);
    // Tous les jobs sont ceux du lot (destinataires de demo) : rien n'a ete mis en file par l'application.
    expect(await prisma.job.count({ where: { NOT: { recipient: { endsWith: "@demo.local" } } } })).toBe(0);
  });
});
