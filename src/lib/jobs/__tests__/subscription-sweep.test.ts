import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { runSubscriptionSweep } from "@/lib/jobs/subscription-sweep";
import { notifySubscriptionExpiring } from "@/lib/notifications/triggers";
import { seedAcceptedPrintRequest } from "@/lib/__tests__/helpers/print-requests";
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

  it("abonnement échu → passe à EXPIRED, plan inchangé", async () => {
    const { org, pro } = await seed();
    await prisma.subscription.create({
      data: { orgId: org.id, planId: pro.id, status: "ACTIVE", endDate: new Date(now.getTime() - H) },
    });
    const res = await runSubscriptionSweep(now);
    expect(res.settled).toBe(1);
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { orgId: org.id } });
    expect(sub.status).toBe("EXPIRED");
    expect(sub.planId).toBe(pro.id);
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

    async function pendingPrint(ageMs: number) {
      const fx = await seedAcceptedPrintRequest({ total: 150000 });
      const payment = await prisma.payment.create({
        data: {
          orgId: fx.org.id, purpose: "PRINT_REQUEST", printRequestId: fx.request.id, userId: fx.owner.id,
          amount: 150000, status: "PENDING", fedapayTransactionId: 77,
          createdAt: new Date(now.getTime() - ageMs),
        },
      });
      return { fx, payment };
    }

    it("PENDING d'impression de 20 min approuvé chez FedaPay → demande PAID, reconciled 1", async () => {
      const { fx, payment } = await pendingPrint(20 * MIN);
      vi.mocked(fetch).mockResolvedValue(txResponse("approved", 150000));
      const res = await runSubscriptionSweep(now);
      expect(res.reconciled).toBe(1);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("APPROVED");
      expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: fx.request.id } })).status).toBe("PAID");
    });

    it("PENDING d'impression de 25 h → EXPIRED, la demande reste ACCEPTED", async () => {
      const { fx, payment } = await pendingPrint(25 * H);
      vi.mocked(fetch).mockResolvedValue(txResponse("pending", 150000));
      const res = await runSubscriptionSweep(now);
      expect(res.expired).toBe(1);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("EXPIRED");
      expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: fx.request.id } })).status).toBe("ACCEPTED");
    });

    it("transaction toujours pending chez FedaPay → non comptée", async () => {
      await pending(20 * MIN);
      vi.mocked(fetch).mockResolvedValue(txResponse("pending"));
      expect((await runSubscriptionSweep(now)).reconciled).toBe(0);
    });

    // Paiement d'impression déjà fermé (CANCELED remplacé ou EXPIRED), créé il y a ageMs.
    async function closedPrint(status: "CANCELED" | "EXPIRED", ageMs: number, txId = 77) {
      const fx = await seedAcceptedPrintRequest({ total: 150000 });
      const payment = await prisma.payment.create({
        data: {
          orgId: fx.org.id, purpose: "PRINT_REQUEST", printRequestId: fx.request.id, userId: fx.owner.id,
          amount: 150000, status, fedapayTransactionId: txId, createdAt: new Date(now.getTime() - ageMs),
        },
      });
      return { fx, payment };
    }
    const statusOf = async (id: string) => (await prisma.payment.findUniqueOrThrow({ where: { id } })).status;
    const requestStatus = async (id: string) =>
      (await prisma.printRequest.findUniqueOrThrow({ where: { id } })).status;

    it("CANCELED (REPLACED) d'impression approuvé chez FedaPay → APPROVED, demande PAID, reconciled 1", async () => {
      const { fx, payment } = await closedPrint("CANCELED", 2 * DAY);
      vi.mocked(fetch).mockResolvedValue(txResponse("approved", 150000));
      const res = await runSubscriptionSweep(now);
      expect(res.reconciled).toBe(1);
      expect(await statusOf(payment.id)).toBe("APPROVED");
      expect(await requestStatus(fx.request.id)).toBe("PAID");
    });

    it("CANCELED approuvé alors que la demande n'attend plus ce paiement → APPROVED, PAYMENT_UNMATCHED et alerte staff", async () => {
      const { fx, payment } = await closedPrint("CANCELED", 2 * DAY);
      await prisma.printRequest.update({ where: { id: fx.request.id }, data: { status: "QUOTED", acceptedTotal: null } });
      vi.mocked(fetch).mockResolvedValue(txResponse("approved", 150000));
      expect((await runSubscriptionSweep(now)).reconciled).toBe(1);
      expect(await statusOf(payment.id)).toBe("APPROVED");
      expect(await requestStatus(fx.request.id)).toBe("QUOTED");
      expect(
        await prisma.printRequestMessage.count({ where: { requestId: fx.request.id, eventType: "PAYMENT_UNMATCHED" } }),
      ).toBe(1);
      const rows = await prisma.notification.findMany({
        where: { userId: fx.staffAdmin.id, title: { startsWith: "Paiement à vérifier" } },
      });
      expect(rows).toHaveLength(1);
    });

    it("EXPIRED d'impression approuvé chez FedaPay → APPROVED, demande PAID", async () => {
      const { fx, payment } = await closedPrint("EXPIRED", 3 * DAY);
      vi.mocked(fetch).mockResolvedValue(txResponse("approved", 150000));
      expect((await runSubscriptionSweep(now)).reconciled).toBe(1);
      expect(await statusOf(payment.id)).toBe("APPROVED");
      expect(await requestStatus(fx.request.id)).toBe("PAID");
    });

    it("CANCELED refusé ou pending chez FedaPay → rien ne change, non compté, rejoué à chaque passe", async () => {
      const { fx, payment } = await closedPrint("CANCELED", 2 * DAY);
      for (const status of ["declined", "pending"]) {
        vi.mocked(fetch).mockResolvedValue(txResponse(status, 150000));
        expect((await runSubscriptionSweep(now)).reconciled).toBe(0);
        expect(await statusOf(payment.id)).toBe("CANCELED");
      }
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(await requestStatus(fx.request.id)).toBe("ACCEPTED");
      expect(await prisma.printRequestMessage.count({ where: { requestId: fx.request.id } })).toBe(0);
    });

    it("CANCELED créé il y a plus de 7 jours → ignoré (aucun appel FedaPay)", async () => {
      const { payment } = await closedPrint("CANCELED", 8 * DAY);
      const expired = await closedPrint("EXPIRED", 8 * DAY, 78);
      vi.mocked(fetch).mockResolvedValue(txResponse("approved", 150000));
      const res = await runSubscriptionSweep(now);
      expect(fetch).not.toHaveBeenCalled();
      expect(res.reconciled).toBe(0);
      expect(await statusOf(payment.id)).toBe("CANCELED");
      expect(await statusOf(expired.payment.id)).toBe("EXPIRED");
    });

    it("paiements d'abonnement CANCELED ou EXPIRED → non relus", async () => {
      const { org, pro, owner } = await seed();
      for (const [i, status] of (["CANCELED", "EXPIRED"] as const).entries()) {
        await prisma.payment.create({
          data: {
            orgId: org.id, planId: pro.id, userId: owner.id, amount: 15000, status,
            fedapayTransactionId: 90 + i, createdAt: new Date(now.getTime() - 2 * DAY),
          },
        });
      }
      vi.mocked(fetch).mockResolvedValue(txResponse("approved"));
      const res = await runSubscriptionSweep(now);
      expect(fetch).not.toHaveBeenCalled();
      expect(res.reconciled).toBe(0);
    });

    it("CANCELED sans transaction FedaPay → ignoré", async () => {
      const { fx, payment } = await closedPrint("CANCELED", 2 * DAY);
      await prisma.payment.update({ where: { id: payment.id }, data: { fedapayTransactionId: null } });
      await runSubscriptionSweep(now);
      expect(fetch).not.toHaveBeenCalled();
      expect(await requestStatus(fx.request.id)).toBe("ACCEPTED");
    });

    it("relecture d'un CANCELED en erreur FedaPay → loggée, la passe continue, le statut est conservé", async () => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      const { payment } = await closedPrint("CANCELED", 2 * DAY);
      vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 500 }));
      const res = await runSubscriptionSweep(now);
      expect(res.reconciled).toBe(0);
      expect(err).toHaveBeenCalled();
      expect(await statusOf(payment.id)).toBe("CANCELED");
    });

    it("échec de la requête des paiements fermés → loggé, expiration et compteurs conservés", async () => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      await pending(25 * H, null);
      vi.spyOn(prisma.payment, "findMany").mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("db"));
      const res = await runSubscriptionSweep(now);
      expect(res.expired).toBe(1);
      expect(err).toHaveBeenCalledWith("[subscription-sweep] replay closed print payments", expect.any(Error));
    });

    it("paiement fermé supprimé entre-temps → ignoré", async () => {
      await closedPrint("CANCELED", 2 * DAY);
      vi.spyOn(prisma.payment, "findMany")
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ fedapayTransactionId: 999, status: "CANCELED" }] as never);
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
