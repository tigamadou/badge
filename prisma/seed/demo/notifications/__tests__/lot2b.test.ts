import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import type { DemoContext } from "../../context";
import { cleanupBilling, seedBilling } from "../../billing";
import { cleanupNotificationsAndActivity, seedNotificationsAndActivity } from "../../notifications";
import { chunkIds } from "../activity";
import { FEDAPAY_ID_BASE } from "../../billing/payments";
import { makePrintOrder } from "@/test/factories";
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

  async function printJob() {
    const user = await prisma.user.findFirstOrThrow({ where: { email: { endsWith: "@demo.local" } } });
    return prisma.job.create({
      data: {
        type: "EMAIL", kind: "notification.print_request_quoted", recipient: user.email, status: "PENDING",
        runAt: new Date(Date.now() + 3650 * DAY_MS), payload: { to: user.email, subject: "Devis", html: "" },
      },
    });
  }

  it("preserve les jobs d'impression du lot 2a, sauf au nettoyage complet", async () => {
    await run();
    const job = await printJob();
    await seedNotificationsAndActivity(ctx);
    expect(await prisma.job.count({ where: { id: job.id } })).toBe(1);
    await cleanupNotificationsAndActivity(ctx);
    expect(await prisma.job.count({ where: { id: job.id } })).toBe(0);
  });

  it("cleanupBilling ne supprime que les paiements d'abonnement", async () => {
    await run();
    const org = await prisma.organization.findFirstOrThrow({ where: { slug: { startsWith: "demo-" }, events: { some: {} } }, include: { events: true } });
    const event = org.events[0];
    const order = await makePrintOrder({ eventId: event.id, orgId: event.orgId });
    const printPayment = await prisma.payment.create({
      data: { orgId: event.orgId, purpose: "PRINT_REQUEST", printRequestId: order.id, amount: 1000, currency: "XOF", status: "PENDING" },
    });
    await cleanupBilling(ctx);
    expect(await prisma.payment.count({ where: { purpose: "SUBSCRIPTION", org: { slug: { startsWith: "demo-" } } } })).toBe(0);
    expect(await prisma.payment.count({ where: { id: printPayment.id } })).toBe(1);
  });

  it("garde les identifiants FedaPay dans 910M-919M, disjoints de la plage 920M du lot 2a", async () => {
    await run();
    const ids = (await prisma.payment.findMany({ where: { fedapayTransactionId: { not: null } } })).map((p) => p.fedapayTransactionId!);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(id).toBeGreaterThanOrEqual(FEDAPAY_ID_BASE);
      expect(id).toBeLessThan(920_000_000);
    }
  });

  it("decoupe les listes d'identifiants en tranches bornees", () => {
    expect(chunkIds([])).toEqual([[]]);
    expect(chunkIds([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
