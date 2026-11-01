import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
vi.mock("@/lib/activity-log", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/activity-log")>();
  return { ...actual, logActivity: vi.fn(actual.logActivity) };
});
import { logActivity } from "@/lib/activity-log";
import { PaymentError, confirmPayment, startCheckout } from "@/lib/payments";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function txBody(over: Record<string, unknown> = {}) {
  return {
    "v1/transaction": { id: 77, reference: "trx_77", amount: 15000, status: "pending", currency: { iso: "XOF" }, ...over },
  };
}

async function seed() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const user = await prisma.user.create({
    data: { email: `p-${stamp}@x.test`, password: "x", name: "Payeur Test" },
  });
  const org = await prisma.organization.create({ data: { name: "Org Test", slug: `pay-${stamp}` } });
  await prisma.orgMembership.create({ data: { userId: user.id, orgId: org.id, role: "OWNER" } });
  const free = await prisma.plan.create({ data: { name: "free", price: null } });
  const pro = await prisma.plan.create({ data: { name: "pro", price: 15000 } });
  const basic = await prisma.plan.create({ data: { name: "basic", price: 5000 } });
  return { user, org, free, pro, basic };
}

async function pendingPayment(orgId: string, planId: string, userId: string, amount = 15000, txId = 77) {
  return prisma.payment.create({
    data: { orgId, planId, userId, amount, status: "PENDING", fedapayTransactionId: txId },
  });
}

describe("payments", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.stubEnv("FEDAPAY_ENVIRONMENT", "sandbox");
    vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_test");
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "whsec");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    process.env.NEXTAUTH_URL = "https://badge.local/";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe("PaymentError", () => {
    it("associe un statut HTTP à chaque code", () => {
      expect(new PaymentError("PLAN_NOT_FOR_SALE").httpStatus).toBe(400);
      expect(new PaymentError("CHANGE_ALREADY_SCHEDULED").httpStatus).toBe(409);
      expect(new PaymentError("PAYMENTS_DISABLED").httpStatus).toBe(503);
      expect(new PaymentError("PROVIDER_ERROR").httpStatus).toBe(502);
    });
  });

  describe("startCheckout", () => {
    it("startCheckout crée un Payment PENDING et renvoie l'URL FedaPay", async () => {
      const { user, org, pro } = await seed();
      fetchMock
        .mockResolvedValueOnce(jsonResponse(txBody()))
        .mockResolvedValueOnce(jsonResponse({ "v1/token": { url: "https://pay.fedapay.com/t" } }));

      const res = await startCheckout({ orgId: org.id, planId: pro.id, userId: user.id });

      expect(res.url).toBe("https://pay.fedapay.com/t");
      const payment = await prisma.payment.findUniqueOrThrow({ where: { id: res.paymentId } });
      expect(payment).toMatchObject({
        status: "PENDING",
        amount: 15000,
        currency: "XOF",
        fedapayTransactionId: 77,
        fedapayReference: "trx_77",
        userId: user.id,
      });
      const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(sent.callback_url).toBe(`https://badge.local/org/${org.id}/subscription/return`);
      expect(sent.description).toBe("Abonnement pro — Org Test");
      expect(sent.custom_metadata).toEqual({ paymentId: payment.id, orgId: org.id });
      expect(sent.customer.email).toBe(user.email);
      const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "PAYMENT_INITIATED" } });
      expect(log.details).toMatchObject({ paymentId: payment.id, planId: pro.id, amount: 15000 });
    });

    it("plan sans prix → PLAN_NOT_FOR_SALE", async () => {
      const { user, org, free } = await seed();
      await expect(startCheckout({ orgId: org.id, planId: free.id, userId: user.id })).rejects.toMatchObject({
        code: "PLAN_NOT_FOR_SALE",
        httpStatus: 400,
      });
    });

    it("plan à prix 0 → PLAN_NOT_FOR_SALE", async () => {
      const { user, org, pro } = await seed();
      await prisma.plan.update({ where: { id: pro.id }, data: { price: 0 } });
      await expect(startCheckout({ orgId: org.id, planId: pro.id, userId: user.id })).rejects.toMatchObject({
        code: "PLAN_NOT_FOR_SALE",
      });
    });

    it("plan inconnu → PLAN_NOT_FOR_SALE", async () => {
      const { user, org } = await seed();
      await expect(startCheckout({ orgId: org.id, planId: "nope", userId: user.id })).rejects.toMatchObject({
        code: "PLAN_NOT_FOR_SALE",
      });
    });

    it("plan archivé → PLAN_NOT_FOR_SALE", async () => {
      const { user, org, pro } = await seed();
      await prisma.plan.update({ where: { id: pro.id }, data: { archived: true } });
      await expect(startCheckout({ orgId: org.id, planId: pro.id, userId: user.id })).rejects.toMatchObject({
        code: "PLAN_NOT_FOR_SALE",
      });
    });

    it("downgrade déjà programmé → CHANGE_ALREADY_SCHEDULED", async () => {
      const { user, org, pro, basic } = await seed();
      await prisma.subscription.create({
        data: { orgId: org.id, planId: pro.id, endDate: new Date(Date.now() + 86400000), scheduledPlanId: basic.id },
      });
      await expect(startCheckout({ orgId: org.id, planId: pro.id, userId: user.id })).rejects.toMatchObject({
        code: "CHANGE_ALREADY_SCHEDULED",
        httpStatus: 409,
      });
    });

    it("FedaPay non configuré → PAYMENTS_DISABLED, aucun Payment créé", async () => {
      const { user, org, pro } = await seed();
      vi.stubEnv("FEDAPAY_SECRET_KEY", "");
      await expect(startCheckout({ orgId: org.id, planId: pro.id, userId: user.id })).rejects.toMatchObject({
        code: "PAYMENTS_DISABLED",
        httpStatus: 503,
      });
      expect(await prisma.payment.count()).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("erreur FedaPay → Payment CANCELED, PROVIDER_ERROR", async () => {
      const { user, org, pro } = await seed();
      fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
      await expect(startCheckout({ orgId: org.id, planId: pro.id, userId: user.id })).rejects.toMatchObject({
        code: "PROVIDER_ERROR",
        httpStatus: 502,
      });
      const payment = await prisma.payment.findFirstOrThrow();
      expect(payment.status).toBe("CANCELED");
      expect(await prisma.activityLog.count({ where: { type: "PAYMENT_INITIATED" } })).toBe(0);
    });

    it("échec du jeton de paiement → transaction enregistrée, Payment CANCELED", async () => {
      const { user, org, pro } = await seed();
      vi.spyOn(console, "error").mockImplementation(() => {});
      fetchMock.mockResolvedValueOnce(jsonResponse(txBody())).mockResolvedValueOnce(jsonResponse({}, 500));
      await expect(startCheckout({ orgId: org.id, planId: pro.id, userId: user.id })).rejects.toMatchObject({
        code: "PROVIDER_ERROR",
      });
      expect(await prisma.payment.findFirstOrThrow()).toMatchObject({
        status: "CANCELED",
        fedapayTransactionId: 77,
        fedapayReference: "trx_77",
      });
      expect(console.error).toHaveBeenCalledWith("[checkout fedapay]", "API_ERROR");
    });

    it("erreur réseau brute → Payment CANCELED, PROVIDER_ERROR", async () => {
      const { user, org, pro } = await seed();
      fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
      await expect(startCheckout({ orgId: org.id, planId: pro.id, userId: user.id })).rejects.toMatchObject({
        code: "PROVIDER_ERROR",
      });
      expect((await prisma.payment.findFirstOrThrow()).status).toBe("CANCELED");
    });

    it("erreur inattendue (hors FedaPay) → Payment CANCELED, PROVIDER_ERROR", async () => {
      const { user, org, pro } = await seed();
      vi.spyOn(console, "error").mockImplementation(() => {});
      delete process.env.NEXTAUTH_URL;
      await expect(startCheckout({ orgId: org.id, planId: pro.id, userId: user.id })).rejects.toMatchObject({
        code: "PROVIDER_ERROR",
      });
      expect((await prisma.payment.findFirstOrThrow()).status).toBe("CANCELED");
      expect(console.error).toHaveBeenCalledWith("[checkout fedapay]", "TypeError");
    });
  });

  describe("confirmPayment", () => {
    it("confirmPayment approved depuis free → plan actif, endDate +30 j, mode IMMEDIATE, 1 notification", async () => {
      const { user, org, free, pro } = await seed();
      await prisma.subscription.create({ data: { orgId: org.id, planId: free.id, endDate: null } });
      const payment = await pendingPayment(org.id, pro.id, user.id);
      fetchMock.mockResolvedValue(jsonResponse(txBody({ status: "approved" })));

      const before = Date.now();
      const res = await confirmPayment(77);

      expect(res).toEqual({ status: "APPROVED", applied: true });
      const sub = await prisma.subscription.findUniqueOrThrow({ where: { orgId: org.id } });
      expect(sub.planId).toBe(pro.id);
      expect(sub.status).toBe("ACTIVE");
      const days = (sub.endDate!.getTime() - before) / 86400000;
      expect(days).toBeGreaterThan(29.99);
      expect(days).toBeLessThan(30.01);
      const p = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(p).toMatchObject({ status: "APPROVED", mode: "IMMEDIATE" });
      expect(p.approvedAt).not.toBeNull();
      expect(await prisma.activityLog.count({ where: { type: "PAYMENT_APPROVED" } })).toBe(1);
      expect(await prisma.activityLog.count({ where: { type: "SUBSCRIPTION_UPDATED" } })).toBe(1);
      expect(
        await prisma.notification.count({ where: { userId: user.id, type: "SUBSCRIPTION_CHANGED", scope: "ORG" } }),
      ).toBe(1);
    });

    it("sans abonnement existant → abonnement créé", async () => {
      const { user, org, pro } = await seed();
      await pendingPayment(org.id, pro.id, user.id);
      fetchMock.mockResolvedValue(jsonResponse(txBody({ status: "transferred" })));
      expect(await confirmPayment(77)).toEqual({ status: "APPROVED", applied: true });
      expect((await prisma.subscription.findUniqueOrThrow({ where: { orgId: org.id } })).planId).toBe(pro.id);
    });

    it("confirmPayment même plan → EXTENSION", async () => {
      const { user, org, pro } = await seed();
      const end = new Date(Date.now() + 10 * 86400000);
      await prisma.subscription.create({ data: { orgId: org.id, planId: pro.id, endDate: end } });
      const payment = await pendingPayment(org.id, pro.id, user.id);
      fetchMock.mockResolvedValue(jsonResponse(txBody({ status: "approved" })));

      await confirmPayment(77);

      const sub = await prisma.subscription.findUniqueOrThrow({ where: { orgId: org.id } });
      expect(sub.endDate!.getTime() - end.getTime()).toBe(30 * 86400000);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).mode).toBe("EXTENSION");
    });

    it("plan moins cher → SCHEDULED, plan courant inchangé", async () => {
      const { user, org, pro, basic } = await seed();
      const end = new Date(Date.now() + 10 * 86400000);
      await prisma.subscription.create({ data: { orgId: org.id, planId: pro.id, endDate: end } });
      const payment = await pendingPayment(org.id, basic.id, user.id, 5000);
      fetchMock.mockResolvedValue(jsonResponse(txBody({ status: "approved", amount: 5000 })));

      await confirmPayment(77);

      const sub = await prisma.subscription.findUniqueOrThrow({ where: { orgId: org.id } });
      expect(sub.planId).toBe(pro.id);
      expect(sub.scheduledPlanId).toBe(basic.id);
      expect(sub.endDate!.getTime()).toBe(end.getTime());
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).mode).toBe("SCHEDULED");
    });

    it("deux confirmPayment concurrents → un seul APPROVED, un seul PAYMENT_APPROVED", async () => {
      const { user, org, free, pro } = await seed();
      await prisma.subscription.create({ data: { orgId: org.id, planId: free.id, endDate: null } });
      await pendingPayment(org.id, pro.id, user.id);
      fetchMock.mockImplementation(async () => jsonResponse(txBody({ status: "approved" })));

      const results = await Promise.all([confirmPayment(77), confirmPayment(77)]);

      expect(results.filter((r) => r?.applied).length).toBe(1);
      expect(results.every((r) => r?.status === "APPROVED")).toBe(true);
      expect(await prisma.activityLog.count({ where: { type: "PAYMENT_APPROVED" } })).toBe(1);
      expect(await prisma.notification.count({ where: { userId: user.id, scope: "ORG" } })).toBe(1);
    });

    it("montant différent → DECLINED, abonnement inchangé", async () => {
      const { user, org, free, pro } = await seed();
      vi.spyOn(console, "error").mockImplementation(() => {});
      await prisma.subscription.create({ data: { orgId: org.id, planId: free.id, endDate: null } });
      await pendingPayment(org.id, pro.id, user.id);
      fetchMock.mockResolvedValue(jsonResponse(txBody({ status: "approved", amount: 100 })));

      expect(await confirmPayment(77)).toEqual({ status: "DECLINED", applied: false });
      expect((await prisma.payment.findUniqueOrThrow({ where: { fedapayTransactionId: 77 } })).status).toBe("DECLINED");
      expect((await prisma.subscription.findUniqueOrThrow({ where: { orgId: org.id } })).planId).toBe(free.id);
      const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "PAYMENT_FAILED" } });
      expect(log.details).toMatchObject({ reason: "MISMATCH" });
      expect(console.error).toHaveBeenCalledWith("[confirm fedapay] montant/devise incohérents", {
        paymentId: expect.any(String),
        expected: { amount: 15000, currency: "XOF" },
        received: { amount: 100, currency: "XOF" },
      });
    });

    it("devise différente → DECLINED ; devise absente → acceptée", async () => {
      const { user, org, pro } = await seed();
      vi.spyOn(console, "error").mockImplementation(() => {});
      await pendingPayment(org.id, pro.id, user.id);
      fetchMock.mockResolvedValue(jsonResponse(txBody({ status: "approved", currency: { iso: "EUR" } })));
      expect(await confirmPayment(77)).toEqual({ status: "DECLINED", applied: false });

      await pendingPayment(org.id, pro.id, user.id, 15000, 78);
      fetchMock.mockResolvedValue(jsonResponse(txBody({ id: 78, status: "approved", currency: undefined })));
      expect(await confirmPayment(78)).toEqual({ status: "APPROVED", applied: true });
    });

    it("currency_id seul : 2 -> DECLINED (MISMATCH), 1 -> APPROVED", async () => {
      const { user, org, pro } = await seed();
      vi.spyOn(console, "error").mockImplementation(() => {});
      await pendingPayment(org.id, pro.id, user.id);
      fetchMock.mockResolvedValue(jsonResponse(txBody({ status: "approved", currency: undefined, currency_id: 2 })));
      expect(await confirmPayment(77)).toEqual({ status: "DECLINED", applied: false });
      const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "PAYMENT_FAILED" } });
      expect(log.details).toMatchObject({ reason: "MISMATCH" });

      await pendingPayment(org.id, pro.id, user.id, 15000, 78);
      fetchMock.mockResolvedValue(jsonResponse(txBody({ id: 78, status: "approved", currency: undefined, currency_id: 1 })));
      expect(await confirmPayment(78)).toEqual({ status: "APPROVED", applied: true });
    });

    it("declined → DECLINED", async () => {
      const { user, org, pro } = await seed();
      await pendingPayment(org.id, pro.id, user.id);
      fetchMock.mockResolvedValue(jsonResponse(txBody({ status: "declined" })));
      expect(await confirmPayment(77)).toEqual({ status: "DECLINED", applied: false });
      const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "PAYMENT_FAILED" } });
      expect(log.details).toMatchObject({ reason: "declined" });
    });

    it("deux paiements distincts du même plan confirmés en parallèle → endDate +60 j", async () => {
      const { user, org, pro } = await seed();
      const end = new Date(Date.now() + 10 * 86400000);
      end.setMilliseconds(0);
      await prisma.subscription.create({ data: { orgId: org.id, planId: pro.id, endDate: end } });
      await pendingPayment(org.id, pro.id, user.id, 15000, 77);
      await pendingPayment(org.id, pro.id, user.id, 15000, 78);
      fetchMock.mockImplementation(async (url: string) =>
        jsonResponse(txBody({ id: url.endsWith("/78") ? 78 : 77, status: "approved" })),
      );

      await Promise.all([confirmPayment(77), confirmPayment(78)]);

      const sub = await prisma.subscription.findUniqueOrThrow({ where: { orgId: org.id } });
      expect(sub.endDate!.getTime()).toBe(end.getTime() + 60 * 86400000);
      const payments = await prisma.payment.findMany();
      expect(payments.map((p) => p.status)).toEqual(["APPROVED", "APPROVED"]);
      expect(payments.map((p) => p.mode)).toEqual(["EXTENSION", "EXTENSION"]);
    });

    it("plan repricé après le checkout → le mode suit le montant payé", async () => {
      const { user, org, pro, basic } = await seed();
      const end = new Date(Date.now() + 10 * 86400000);
      await prisma.subscription.create({ data: { orgId: org.id, planId: pro.id, endDate: end } });
      // checkout fait quand basic coûtait 5000 ; le plan est ensuite repricé au-dessus de pro
      const payment = await pendingPayment(org.id, basic.id, user.id, 5000);
      await prisma.plan.update({ where: { id: basic.id }, data: { price: 99000 } });
      fetchMock.mockResolvedValue(jsonResponse(txBody({ status: "approved", amount: 5000 })));

      await confirmPayment(77);

      expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).mode).toBe("SCHEDULED");
      expect((await prisma.subscription.findUniqueOrThrow({ where: { orgId: org.id } })).planId).toBe(pro.id);
    });

    it("plan archivé à la confirmation → appliqué quand même", async () => {
      const { user, org, pro } = await seed();
      await pendingPayment(org.id, pro.id, user.id);
      await prisma.plan.update({ where: { id: pro.id }, data: { archived: true } });
      fetchMock.mockResolvedValue(jsonResponse(txBody({ status: "approved" })));
      expect(await confirmPayment(77)).toEqual({ status: "APPROVED", applied: true });
      expect((await prisma.subscription.findUniqueOrThrow({ where: { orgId: org.id } })).planId).toBe(pro.id);
    });

    it("approuver le paiement de l'org A ne touche pas l'abonnement de l'org B", async () => {
      const { user, org, free, pro } = await seed();
      const orgB = await prisma.organization.create({ data: { name: "B", slug: `b-${Date.now()}` } });
      const subB = await prisma.subscription.create({ data: { orgId: orgB.id, planId: free.id, endDate: null } });
      await pendingPayment(org.id, pro.id, user.id);
      fetchMock.mockResolvedValue(jsonResponse(txBody({ status: "approved" })));
      await confirmPayment(77);
      expect(await prisma.subscription.findUniqueOrThrow({ where: { id: subB.id } })).toMatchObject({
        planId: free.id,
        endDate: null,
      });
    });

    it("échec du journal après commit → paiement quand même appliqué", async () => {
      const { user, org, pro } = await seed();
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(logActivity).mockRejectedValueOnce(new Error("log down"));
      await pendingPayment(org.id, pro.id, user.id);
      fetchMock.mockResolvedValue(jsonResponse(txBody({ status: "approved" })));
      expect(await confirmPayment(77)).toEqual({ status: "APPROVED", applied: true });
      expect(console.error).toHaveBeenCalled();
    });

    it("deux declined concurrents → un seul PAYMENT_FAILED", async () => {
      const { user, org, pro } = await seed();
      await pendingPayment(org.id, pro.id, user.id);
      fetchMock.mockImplementation(async () => jsonResponse(txBody({ status: "declined" })));
      await Promise.all([confirmPayment(77), confirmPayment(77)]);
      expect(await prisma.activityLog.count({ where: { type: "PAYMENT_FAILED" } })).toBe(1);
    });

    it("canceled → CANCELED", async () => {
      const { user, org, pro } = await seed();
      await pendingPayment(org.id, pro.id, user.id);
      fetchMock.mockResolvedValue(jsonResponse(txBody({ status: "canceled" })));
      expect(await confirmPayment(77)).toEqual({ status: "CANCELED", applied: false });
    });

    it("pending → reste PENDING", async () => {
      const { user, org, pro } = await seed();
      const payment = await pendingPayment(org.id, pro.id, user.id);
      fetchMock.mockResolvedValue(jsonResponse(txBody({ status: "pending" })));
      expect(await confirmPayment(77)).toEqual({ status: "PENDING", applied: false });
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PENDING");
    });

    it("transaction inconnue → null", async () => {
      expect(await confirmPayment(999)).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("paiement déjà traité → statut sans appel FedaPay", async () => {
      const { user, org, pro } = await seed();
      await pendingPayment(org.id, pro.id, user.id);
      await prisma.payment.updateMany({ data: { status: "APPROVED" } });
      expect(await confirmPayment(77)).toEqual({ status: "APPROVED", applied: false });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("paiement EXPIRED approuvé ensuite par FedaPay → APPROVED et abonnement appliqué", async () => {
      const { user, org, free, pro } = await seed();
      await prisma.subscription.create({ data: { orgId: org.id, planId: free.id, endDate: null } });
      const payment = await pendingPayment(org.id, pro.id, user.id);
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "EXPIRED" } });
      fetchMock.mockResolvedValue(jsonResponse(txBody({ status: "approved" })));

      expect(await confirmPayment(77)).toEqual({ status: "APPROVED", applied: true });
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("APPROVED");
      expect((await prisma.subscription.findUniqueOrThrow({ where: { orgId: org.id } })).planId).toBe(pro.id);
    });

    it("paiement EXPIRED toujours pending chez FedaPay → reste EXPIRED", async () => {
      const { user, org, pro } = await seed();
      const payment = await pendingPayment(org.id, pro.id, user.id);
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "EXPIRED" } });
      fetchMock.mockResolvedValue(jsonResponse(txBody({ status: "pending" })));
      expect(await confirmPayment(77)).toEqual({ status: "EXPIRED", applied: false });
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("EXPIRED");
    });

    it("paiement EXPIRED refusé par FedaPay → DECLINED", async () => {
      const { user, org, pro } = await seed();
      const payment = await pendingPayment(org.id, pro.id, user.id);
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "EXPIRED" } });
      fetchMock.mockResolvedValue(jsonResponse(txBody({ status: "declined" })));
      expect(await confirmPayment(77)).toEqual({ status: "DECLINED", applied: false });
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("DECLINED");
    });

    it("erreur FedaPay à la relecture → propagée, paiement PENDING", async () => {
      const { user, org, pro } = await seed();
      const payment = await pendingPayment(org.id, pro.id, user.id);
      fetchMock.mockResolvedValue(jsonResponse({}, 500));
      await expect(confirmPayment(77)).rejects.toMatchObject({ code: "API_ERROR" });
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PENDING");
    });

    it("paiement sans payeur (userId null) → appliqué", async () => {
      const { org, pro } = await seed();
      await prisma.payment.create({
        data: { orgId: org.id, planId: pro.id, amount: 15000, fedapayTransactionId: 77 },
      });
      fetchMock.mockResolvedValue(jsonResponse(txBody({ status: "approved" })));
      expect(await confirmPayment(77)).toEqual({ status: "APPROVED", applied: true });
      fetchMock.mockResolvedValue(jsonResponse(txBody({ id: 79, status: "declined" })));
      await prisma.payment.create({
        data: { orgId: org.id, planId: pro.id, amount: 15000, fedapayTransactionId: 79 },
      });
      expect(await confirmPayment(79)).toEqual({ status: "DECLINED", applied: false });
    });
  });
});
