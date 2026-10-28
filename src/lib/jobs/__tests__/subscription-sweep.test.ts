import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { runSubscriptionSweep } from "@/lib/jobs/subscription-sweep";
import { notifySubscriptionExpiring } from "@/lib/notifications/triggers";
import { REMINDER_DAYS, SUBSCRIPTION_SWEEP_INTERVAL_MS } from "@/lib/jobs/constants";

const now = new Date("2026-10-28T12:00:00.000Z");
const H = 3_600_000;
const DAY = 24 * H;
const MIN = 60_000;

function txResponse(status: string, amount = 15000) {
  return new Response(
    JSON.stringify({ "v1/transaction": { id: 77, reference: "trx_77", amount, status, currency: { iso: "XOF" } } }),
  );
}

async function seed() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const owner = await prisma.user.create({ data: { email: `sw-${stamp}@x.test`, password: "x", name: "Owner" } });
  const org = await prisma.organization.create({ data: { name: "Org Sweep", slug: `sw-${stamp}` } });
  await prisma.orgMembership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });
  const free = await prisma.plan.create({ data: { name: "free", price: null } });
  const pro = await prisma.plan.create({ data: { name: "pro", price: 15000 } });
  const basic = await prisma.plan.create({ data: { name: "basic", price: 5000 } });
  return { owner, org, free, pro, basic };
}

describe("runSubscriptionSweep", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("constantes", () => {
    expect(SUBSCRIPTION_SWEEP_INTERVAL_MS).toBe(3_600_000);
    expect(REMINDER_DAYS).toEqual([7, 1]);
  });

  it("abonnement échu → repasse sur free", async () => {
    const { org, free, pro } = await seed();
    await prisma.subscription.create({
      data: { orgId: org.id, planId: pro.id, status: "ACTIVE", endDate: new Date(now.getTime() - H) },
    });
    const res = await runSubscriptionSweep(now);
    expect(res.settled).toBe(1);
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { orgId: org.id } });
    expect(sub.planId).toBe(free.id);
  });

  it("endDate à 6 j → rappel J-7 une seule fois sur deux passages", async () => {
    const { org, pro, owner } = await seed();
    await prisma.subscription.create({
      data: { orgId: org.id, planId: pro.id, endDate: new Date(now.getTime() + 6 * DAY) },
    });
    expect((await runSubscriptionSweep(now)).reminded).toBe(1);
    expect((await runSubscriptionSweep(new Date(now.getTime() + H))).reminded).toBe(0);
    const reminders = await prisma.subscriptionReminder.findMany();
    expect(reminders.map((r) => r.daysBefore)).toEqual([7]);
    const notifs = await prisma.notification.findMany({ where: { userId: owner.id, type: "SUBSCRIPTION_EXPIRING" } });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].title).toBe("Votre abonnement pro expire dans 7 jours");
  });

  it("endDate à 20 h → seul J-1 est envoyé", async () => {
    const { org, pro } = await seed();
    await prisma.subscription.create({
      data: { orgId: org.id, planId: pro.id, endDate: new Date(now.getTime() + 20 * H) },
    });
    expect((await runSubscriptionSweep(now)).reminded).toBe(1);
    const reminders = await prisma.subscriptionReminder.findMany();
    expect(reminders.map((r) => r.daysBefore)).toEqual([1]);
  });

  it("nouvelle échéance après renouvellement → nouveaux rappels", async () => {
    const { org, pro } = await seed();
    const sub = await prisma.subscription.create({
      data: { orgId: org.id, planId: pro.id, endDate: new Date(now.getTime() + 6 * DAY) },
    });
    await runSubscriptionSweep(now);
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { endDate: new Date(now.getTime() + 33 * DAY) },
    });
    const later = new Date(now.getTime() + 28 * DAY);
    expect((await runSubscriptionSweep(later)).reminded).toBe(1);
    expect(await prisma.subscriptionReminder.count()).toBe(2);
  });

  it("downgrade programmé → pas de rappel", async () => {
    const { org, pro, basic } = await seed();
    await prisma.subscription.create({
      data: { orgId: org.id, planId: pro.id, scheduledPlanId: basic.id, endDate: new Date(now.getTime() + 2 * DAY) },
    });
    expect((await runSubscriptionSweep(now)).reminded).toBe(0);
  });

  it("free (endDate null) → pas de rappel", async () => {
    const { org, free } = await seed();
    await prisma.subscription.create({ data: { orgId: org.id, planId: free.id, endDate: null } });
    expect(await runSubscriptionSweep(now)).toEqual({ settled: 0, reminded: 0, reconciled: 0, expired: 0 });
  });

  describe("paiements orphelins", () => {
    async function pending(ageMs: number, txId: number | null = 77) {
      const { org, pro, owner } = await seed();
      return prisma.payment.create({
        data: {
          orgId: org.id,
          planId: pro.id,
          userId: owner.id,
          amount: 15000,
          status: "PENDING",
          fedapayTransactionId: txId,
          createdAt: new Date(now.getTime() - ageMs),
        },
      });
    }

    beforeEach(async () => {
      vi.stubEnv("FEDAPAY_ENVIRONMENT", "sandbox");
      vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_test");
      vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "whsec");
    });

    it("PENDING de 20 min → confirmPayment appelé", async () => {
      const p = await pending(20 * MIN);
      vi.mocked(fetch).mockResolvedValue(txResponse("approved"));
      const res = await runSubscriptionSweep(now);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(res.reconciled).toBe(1);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("APPROVED");
    });

    it("transaction toujours pending chez FedaPay → non comptée", async () => {
      await pending(20 * MIN);
      vi.mocked(fetch).mockResolvedValue(txResponse("pending"));
      expect((await runSubscriptionSweep(now)).reconciled).toBe(0);
    });

    it("PENDING de 25 h → EXPIRED (FedaPay consulté, toujours pending)", async () => {
      const p = await pending(25 * H);
      vi.mocked(fetch).mockResolvedValue(txResponse("pending"));
      const res = await runSubscriptionSweep(now);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(res.expired).toBe(1);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("EXPIRED");
    });

    it("PENDING de 25 h + FedaPay en erreur → reste PENDING", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const p = await pending(25 * H);
      vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 500 }));
      const res = await runSubscriptionSweep(now);
      expect(res.expired).toBe(0);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("PENDING");
      vi.mocked(fetch).mockRejectedValue(new Error("réseau"));
      expect((await runSubscriptionSweep(now)).expired).toBe(0);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("PENDING");
    });

    it("PENDING de 25 h + transaction introuvable (404) → EXPIRED", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const p = await pending(25 * H);
      vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 404 }));
      const res = await runSubscriptionSweep(now);
      expect(res.expired).toBe(1);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("EXPIRED");
    });

    it("PENDING de 25 h approuvé par FedaPay → APPROVED, pas EXPIRED", async () => {
      const p = await pending(25 * H);
      vi.mocked(fetch).mockResolvedValue(txResponse("approved"));
      const res = await runSubscriptionSweep(now);
      expect(res.expired).toBe(0);
      expect(res.reconciled).toBe(1);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("APPROVED");
    });

    it("PENDING de 25 h sans transaction FedaPay → EXPIRED", async () => {
      const p = await pending(25 * H, null);
      const res = await runSubscriptionSweep(now);
      expect(fetch).not.toHaveBeenCalled();
      expect(res.expired).toBe(1);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("EXPIRED");
    });

    it("PENDING de 5 min → ignoré", async () => {
      const p = await pending(5 * MIN);
      const res = await runSubscriptionSweep(now);
      expect(fetch).not.toHaveBeenCalled();
      expect(res.reconciled + res.expired).toBe(0);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("PENDING");
    });

    it("PENDING sans transaction FedaPay → pas d'appel", async () => {
      await pending(20 * MIN, null);
      await runSubscriptionSweep(now);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("erreur FedaPay → loggée, le paiement reste PENDING, la passe continue", async () => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      const p = await pending(20 * MIN);
      vi.mocked(fetch).mockRejectedValue(new Error("réseau"));
      const res = await runSubscriptionSweep(now);
      expect(res.reconciled).toBe(0);
      expect(err).toHaveBeenCalled();
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("PENDING");
    });

    it("paiement supprimé entre-temps → ignoré", async () => {
      const p = await pending(20 * MIN);
      vi.spyOn(prisma.payment, "findMany").mockResolvedValueOnce([{ fedapayTransactionId: 999 }] as never);
      const res = await runSubscriptionSweep(now);
      expect(res.reconciled).toBe(0);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("PENDING");
    });
  });

  describe("résilience", () => {
    it("une erreur sur une org est loggée et la boucle continue", async () => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      const { org, pro } = await seed();
      await prisma.subscription.create({
        data: { orgId: org.id, planId: pro.id, endDate: new Date(now.getTime() - H) },
      });
      const other = await prisma.organization.create({ data: { name: "O2", slug: `o2-${Date.now()}` } });
      await prisma.subscription.create({
        data: { orgId: other.id, planId: pro.id, endDate: new Date(now.getTime() - H) },
      });
      const spy = vi.spyOn(prisma.subscription, "findUniqueOrThrow").mockRejectedValueOnce(new Error("boom"));
      const res = await runSubscriptionSweep(now);
      expect(spy).toHaveBeenCalled();
      expect(res.settled).toBe(1);
      expect(err).toHaveBeenCalled();
    });

    it("erreur d'écriture d'un rappel → loggée, on continue", async () => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      const { org, pro } = await seed();
      await prisma.subscription.create({
        data: { orgId: org.id, planId: pro.id, endDate: new Date(now.getTime() + 2 * DAY) },
      });
      vi.spyOn(prisma.subscriptionReminder, "create").mockRejectedValueOnce(new Error("db"));
      expect((await runSubscriptionSweep(now)).reminded).toBe(0);
      expect(err).toHaveBeenCalled();
    });

    it("ne lève jamais, même si les requêtes de chaque étape échouent", async () => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(prisma.subscription, "findMany").mockRejectedValue(new Error("db"));
      vi.spyOn(prisma.payment, "findMany").mockRejectedValue(new Error("db"));
      expect(await runSubscriptionSweep(now)).toEqual({ settled: 0, reminded: 0, reconciled: 0, expired: 0 });
      expect(err).toHaveBeenCalledTimes(3);
    });

    it("échec de l'expiration des paiements → loggé", async () => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(prisma.payment, "updateMany").mockRejectedValueOnce(new Error("db"));
      expect((await runSubscriptionSweep(now)).expired).toBe(0);
      expect(err).toHaveBeenCalled();
    });
  });
});

describe("notifySubscriptionExpiring", () => {
  it("org inconnue → ne fait rien", async () => {
    await notifySubscriptionExpiring("inconnue", 7, now);
    expect(await prisma.notification.count()).toBe(0);
  });

  it("org sans abonnement → ne fait rien", async () => {
    const org = await prisma.organization.create({ data: { name: "Sans", slug: `ns-${Date.now()}` } });
    await notifySubscriptionExpiring(org.id, 1, now);
    expect(await prisma.notification.count()).toBe(0);
  });
});
