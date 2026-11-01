import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { PaymentError, confirmPayment, startPrintRequestCheckout } from "@/lib/payments";
import { markPaidManually } from "@/lib/print-requests/quote";
import { seedAcceptedPrintRequest } from "./helpers/print-requests";

function txResponse(status: string, amount = 150000, id = 77) {
  return new Response(
    JSON.stringify({ "v1/transaction": { id, reference: `trx_${id}`, amount, status, currency: { iso: "XOF" } } }),
    { status: 200 },
  );
}

async function seed(opts: { total?: number; amount?: number; txId?: number } = {}) {
  const total = opts.total ?? 150000;
  const fx = await seedAcceptedPrintRequest({ total });
  const payment = await prisma.payment.create({
    data: {
      orgId: fx.org.id, purpose: "PRINT_REQUEST", printRequestId: fx.request.id, userId: fx.owner.id,
      amount: opts.amount ?? 150000, status: "PENDING", fedapayTransactionId: opts.txId ?? 77,
    },
  });
  return { ...fx, payment };
}

const thread = (requestId: string, eventType: string) =>
  prisma.printRequestMessage.findMany({ where: { requestId, eventType } });
const approvedLogs = (paymentId: string) =>
  prisma.activityLog.findMany({ where: { type: "PAYMENT_APPROVED", targetId: paymentId } });

describe("confirmPayment : demande d'impression", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("FEDAPAY_ENVIRONMENT", "sandbox");
    vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_test");
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "wh");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("approved → Payment APPROVED, demande PAID avec paidAt et paidPaymentId, entrée « Paiement reçu »", async () => {
    const t = await seed();
    fetchMock.mockResolvedValue(txResponse("approved"));
    expect(await confirmPayment(77)).toEqual({ status: "APPROVED", applied: true });
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: t.payment.id } });
    expect(payment).toMatchObject({ status: "APPROVED", mode: null });
    expect(payment.approvedAt).not.toBeNull();
    const request = await prisma.printRequest.findUniqueOrThrow({ where: { id: t.request.id } });
    expect(request.status).toBe("PAID");
    expect(request.paidAt).not.toBeNull();
    expect(request.paidPaymentId).toBe(t.payment.id);
    const entries = await thread(t.request.id, "PAYMENT_RECEIVED");
    expect(entries).toHaveLength(1);
    expect(entries[0].details).toMatchObject({ amount: 150000, paymentId: t.payment.id });
  });

  it("approved → aucune Subscription créée ni modifiée", async () => {
    const t = await seed();
    fetchMock.mockResolvedValue(txResponse("approved"));
    await confirmPayment(77);
    expect(await prisma.subscription.count({ where: { orgId: t.org.id } })).toBe(0);
  });

  it("approved → PAYMENT_APPROVED { purpose: 'PRINT_REQUEST', unmatched: false } et notifications admin évènement + STAFF_ADMIN", async () => {
    const t = await seed();
    fetchMock.mockResolvedValue(txResponse("approved"));
    await confirmPayment(77);
    const logs = await approvedLogs(t.payment.id);
    expect(logs).toHaveLength(1);
    expect(logs[0].details).toMatchObject({
      paymentId: t.payment.id, purpose: "PRINT_REQUEST", printRequestId: t.request.id, unmatched: false,
    });
    const rows = await prisma.notification.findMany({
      where: { type: "PRINT_REQUEST_STATUS_CHANGED", userId: { in: [t.staffAdmin.id, t.manager.id] } },
    });
    expect(rows.find((r) => r.userId === t.staffAdmin.id)).toMatchObject({
      title: `Demande ${t.request.reference} payée`, href: `/platform/print/requests/${t.request.id}`,
    });
    expect(rows.find((r) => r.userId === t.manager.id)).toMatchObject({
      href: `/event/${t.event.id}/print/${t.request.id}`,
    });
  });

  it("deux confirmPayment concurrents → un seul PAID, une seule entrée du fil, un seul PAYMENT_APPROVED", async () => {
    const t = await seed();
    fetchMock.mockImplementation(async () => txResponse("approved"));
    const results = await Promise.all([confirmPayment(77), confirmPayment(77)]);
    expect(results.filter((r) => r?.applied)).toHaveLength(1);
    expect(await thread(t.request.id, "PAYMENT_RECEIVED")).toHaveLength(1);
    expect(await approvedLogs(t.payment.id)).toHaveLength(1);
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: t.request.id } })).status).toBe("PAID");
  });

  it("approved avec crédit d'impression : mouvement SPENT dans la même transaction ; webhook rejoué : un seul mouvement", async () => {
    const t = await seed({ total: 15000, amount: 15000 });
    await prisma.orgPrintCredit.create({ data: { orgId: t.org.id, kind: "EARNED", amount: 45000 } });
    await prisma.printQuoteLine.create({
      data: {
        requestId: t.request.id, kind: "DISCOUNT", label: "Crédit d'impression", quantity: 1, unitPrice: -45000,
        lineTotal: -45000, position: 0, addedBy: "STAFF", usesOrgCredit: true,
      },
    });
    fetchMock.mockResolvedValue(txResponse("approved", 15000));
    expect(await confirmPayment(77)).toEqual({ status: "APPROVED", applied: true });
    expect(await confirmPayment(77)).toEqual({ status: "APPROVED", applied: false });
    const spent = await prisma.orgPrintCredit.findMany({ where: { requestId: t.request.id } });
    expect(spent).toMatchObject([{ kind: "SPENT", amount: -45000, orgId: t.org.id }]);
    expect(await thread(t.request.id, "ORG_CREDIT_SPENT")).toHaveLength(1);
  });

  it("course markPaidManually / confirmPayment sur une demande avec crédit : un seul mouvement SPENT", async () => {
    // Paiement CANCELED puis approuvé tardivement chez FedaPay : aucune sonde PENDING ne départage
    // les deux chemins, seul le verrou de la demande les sérialise.
    for (let i = 0; i < 3; i++) {
      const t = await seed({ total: 15000, amount: 15000, txId: 900 + i });
      await prisma.payment.update({ where: { id: t.payment.id }, data: { status: "CANCELED" } });
      await prisma.orgPrintCredit.create({ data: { orgId: t.org.id, kind: "EARNED", amount: 45000 } });
      await prisma.printQuoteLine.create({
        data: {
          requestId: t.request.id, kind: "DISCOUNT", label: "Crédit d'impression", quantity: 1, unitPrice: -45000,
          lineTotal: -45000, position: 0, addedBy: "STAFF", usesOrgCredit: true,
        },
      });
      fetchMock.mockResolvedValue(txResponse("approved", 15000, 900 + i));
      const res = await Promise.allSettled([
        confirmPayment(900 + i),
        markPaidManually({ requestId: t.request.id, userId: t.staffAdmin.id, reason: "Virement reçu" }),
      ]);
      expect(res.some((x) => x.status === "fulfilled")).toBe(true);
      expect(await prisma.orgPrintCredit.findMany({ where: { requestId: t.request.id, kind: "SPENT" } })).toMatchObject([
        { amount: -45000, orgId: t.org.id },
      ]);
      expect(await thread(t.request.id, "ORG_CREDIT_SPENT")).toHaveLength(1);
      const sum = await prisma.orgPrintCredit.aggregate({ where: { orgId: t.org.id }, _sum: { amount: true } });
      expect(sum._sum.amount).toBe(0);
      expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: t.request.id } })).status).toBe("PAID");
    }
  });

  it("approved sans crédit : aucun mouvement ; paiement non attendu (UNMATCHED) : aucun mouvement", async () => {
    const t = await seed();
    fetchMock.mockResolvedValue(txResponse("approved"));
    await confirmPayment(77);
    expect(await prisma.orgPrintCredit.count({ where: { requestId: t.request.id } })).toBe(0);

    const u = await seed({ txId: 78 });
    await prisma.printQuoteLine.create({
      data: {
        requestId: u.request.id, kind: "DISCOUNT", label: "Crédit", quantity: 1, unitPrice: -100,
        lineTotal: -100, position: 0, addedBy: "STAFF", usesOrgCredit: true,
      },
    });
    await prisma.printRequest.update({ where: { id: u.request.id }, data: { status: "CANCELLED" } });
    fetchMock.mockResolvedValue(txResponse("approved", 150000, 78));
    await confirmPayment(78);
    expect(await prisma.orgPrintCredit.count({ where: { requestId: u.request.id } })).toBe(0);
  });

  it("montant FedaPay 149 000 → DECLINED, entrée PAYMENT_FAILED reason MISMATCH, demande ACCEPTED", async () => {
    const t = await seed();
    fetchMock.mockResolvedValue(txResponse("approved", 149000));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await confirmPayment(77)).toEqual({ status: "DECLINED", applied: false });
    const entries = await thread(t.request.id, "PAYMENT_FAILED");
    expect(entries).toHaveLength(1);
    expect(entries[0].details).toMatchObject({ reason: "MISMATCH", amount: 150000, paymentId: t.payment.id });
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: t.request.id } })).status).toBe("ACCEPTED");
    const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "PAYMENT_FAILED", targetId: t.payment.id } });
    expect(log.details).toMatchObject({ purpose: "PRINT_REQUEST", printRequestId: t.request.id, reason: "MISMATCH" });
  });

  it("declined → DECLINED, entrée PAYMENT_FAILED reason declined, demande ACCEPTED ; canceled → CANCELED", async () => {
    const t = await seed();
    fetchMock.mockResolvedValue(txResponse("declined"));
    expect(await confirmPayment(77)).toEqual({ status: "DECLINED", applied: false });
    expect((await thread(t.request.id, "PAYMENT_FAILED"))[0].details).toMatchObject({ reason: "declined" });
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: t.request.id } })).status).toBe("ACCEPTED");
    // Rejeu : idempotent, aucune seconde entrée.
    expect(await confirmPayment(77)).toEqual({ status: "DECLINED", applied: false });
    expect(await thread(t.request.id, "PAYMENT_FAILED")).toHaveLength(1);

    const c = await seed({ txId: 78 });
    fetchMock.mockResolvedValue(txResponse("canceled", 150000, 78));
    expect(await confirmPayment(78)).toEqual({ status: "CANCELED", applied: false });
    expect((await thread(c.request.id, "PAYMENT_FAILED"))[0].details).toMatchObject({ reason: "canceled" });
  });

  it("EXPIRED approuvé alors que la demande est QUOTED → APPROVED, applied false, demande QUOTED, entrée PAYMENT_UNMATCHED, notification staff seule", async () => {
    const t = await seed();
    await prisma.printRequest.update({ where: { id: t.request.id }, data: { status: "QUOTED", acceptedTotal: null } });
    await prisma.payment.update({ where: { id: t.payment.id }, data: { status: "EXPIRED" } });
    fetchMock.mockResolvedValue(txResponse("approved"));
    expect(await confirmPayment(77)).toEqual({ status: "APPROVED", applied: false });
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: t.request.id } })).status).toBe("QUOTED");
    const entries = await thread(t.request.id, "PAYMENT_UNMATCHED");
    expect(entries).toHaveLength(1);
    expect(entries[0].details).toMatchObject({ paymentId: t.payment.id, amount: 150000 });
    expect((await approvedLogs(t.payment.id))[0].details).toMatchObject({ unmatched: true });
    const rows = await prisma.notification.findMany({
      where: { type: "PRINT_REQUEST_STATUS_CHANGED", userId: { in: [t.staffAdmin.id, t.manager.id] } },
    });
    expect(rows.map((r) => r.userId)).toEqual([t.staffAdmin.id]);
    expect(rows[0]).toMatchObject({ title: `Paiement à vérifier : ${t.request.reference}` });
  });

  it("approuvé, demande ACCEPTED mais acceptedTotal 160 000 ≠ 150 000 → UNMATCHED, demande ACCEPTED", async () => {
    const t = await seed({ total: 160000, amount: 150000 });
    fetchMock.mockResolvedValue(txResponse("approved"));
    expect(await confirmPayment(77)).toEqual({ status: "APPROVED", applied: false });
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: t.request.id } })).status).toBe("ACCEPTED");
    expect(await thread(t.request.id, "PAYMENT_UNMATCHED")).toHaveLength(1);
    expect(await thread(t.request.id, "PAYMENT_RECEIVED")).toHaveLength(0);
  });

  it("approuvé alors que la demande est déjà PAID → UNMATCHED", async () => {
    const t = await seed();
    await prisma.printRequest.update({ where: { id: t.request.id }, data: { status: "PAID", paidAt: new Date() } });
    fetchMock.mockResolvedValue(txResponse("approved"));
    expect(await confirmPayment(77)).toEqual({ status: "APPROVED", applied: false });
    expect(await thread(t.request.id, "PAYMENT_UNMATCHED")).toHaveLength(1);
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: t.request.id } })).paidPaymentId).toBeNull();
  });

  it("pending → inchangé ; échec du journal après paiement → l'issue est conservée", async () => {
    const t = await seed();
    fetchMock.mockResolvedValue(txResponse("pending"));
    expect(await confirmPayment(77)).toEqual({ status: "PENDING", applied: false });
    fetchMock.mockResolvedValue(txResponse("approved"));
    const actLog = await import("@/lib/activity-log");
    vi.spyOn(actLog, "logActivity").mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await confirmPayment(77)).toEqual({ status: "APPROVED", applied: true });
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: t.request.id } })).status).toBe("PAID");
  });

  it("échec du journal → la notification est quand même créée", async () => {
    const t = await seed();
    fetchMock.mockResolvedValue(txResponse("approved"));
    const actLog = await import("@/lib/activity-log");
    vi.spyOn(actLog, "logActivity").mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await confirmPayment(77)).toEqual({ status: "APPROVED", applied: true });
    const rows = await prisma.notification.findMany({
      where: { type: "PRINT_REQUEST_STATUS_CHANGED", userId: t.staffAdmin.id },
    });
    expect(rows).toHaveLength(1);
  });

  it("échec de la notification → l'issue est conservée", async () => {
    const t = await seed();
    fetchMock.mockResolvedValue(txResponse("approved"));
    const triggers = await import("@/lib/notifications/triggers");
    vi.spyOn(triggers, "notifyPrintRequestPaid").mockRejectedValue(new Error("boom"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await confirmPayment(77)).toEqual({ status: "APPROVED", applied: true });
    expect(errorSpy).toHaveBeenCalledWith("[payment] notification apres paiement en echec", expect.any(Error));
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: t.request.id } })).status).toBe("PAID");
  });

  it("paiement CANCELED approuvé tard, demande encore ACCEPTED → APPROVED, demande PAID", async () => {
    const t = await seed();
    await prisma.payment.update({ where: { id: t.payment.id }, data: { status: "CANCELED" } });
    fetchMock.mockResolvedValue(txResponse("approved"));
    expect(await confirmPayment(77)).toEqual({ status: "APPROVED", applied: true });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: t.payment.id } })).status).toBe("APPROVED");
    const request = await prisma.printRequest.findUniqueOrThrow({ where: { id: t.request.id } });
    expect(request).toMatchObject({ status: "PAID", paidPaymentId: t.payment.id });
  });

  it("paiement CANCELED approuvé tard, demande déjà PAID par un autre paiement → UNMATCHED et alerte staff", async () => {
    const t = await seed();
    const other = await prisma.payment.create({
      data: {
        orgId: t.org.id, purpose: "PRINT_REQUEST", printRequestId: t.request.id, userId: t.owner.id,
        amount: 150000, status: "APPROVED", fedapayTransactionId: 99,
      },
    });
    await prisma.printRequest.update({
      where: { id: t.request.id }, data: { status: "PAID", paidAt: new Date(), paidPaymentId: other.id },
    });
    await prisma.payment.update({ where: { id: t.payment.id }, data: { status: "CANCELED" } });
    fetchMock.mockResolvedValue(txResponse("approved"));
    expect(await confirmPayment(77)).toEqual({ status: "APPROVED", applied: false });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: t.payment.id } })).status).toBe("APPROVED");
    expect(await thread(t.request.id, "PAYMENT_UNMATCHED")).toHaveLength(1);
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: t.request.id } })).paidPaymentId).toBe(other.id);
    const rows = await prisma.notification.findMany({
      where: { type: "PRINT_REQUEST_STATUS_CHANGED", userId: t.staffAdmin.id },
    });
    expect(rows[0]).toMatchObject({ title: `Paiement à vérifier : ${t.request.reference}` });
  });

  it("paiement sans utilisateur (userId null) : approuvé et refusé sans userId dans le journal", async () => {
    const t = await seed();
    await prisma.payment.update({ where: { id: t.payment.id }, data: { userId: null } });
    fetchMock.mockResolvedValue(txResponse("approved"));
    expect(await confirmPayment(77)).toEqual({ status: "APPROVED", applied: true });
    expect((await approvedLogs(t.payment.id))[0].userId).toBeNull();

    const d = await seed({ txId: 78 });
    await prisma.payment.update({ where: { id: d.payment.id }, data: { userId: null } });
    fetchMock.mockResolvedValue(txResponse("declined", 150000, 78));
    expect(await confirmPayment(78)).toEqual({ status: "DECLINED", applied: false });
    const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "PAYMENT_FAILED", targetId: d.payment.id } });
    expect(log.userId).toBeNull();
  });

  it("CANCELED approuvé tard avec un montant incohérent → DECLINED/MISMATCH, entrée du fil, alerte staff, statut retourné = statut stocké", async () => {
    const t = await seed();
    await prisma.payment.update({ where: { id: t.payment.id }, data: { status: "CANCELED" } });
    fetchMock.mockResolvedValue(txResponse("approved", 149000));
    expect(await confirmPayment(77)).toEqual({ status: "DECLINED", applied: false });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: t.payment.id } })).status).toBe("DECLINED");
    const entries = await thread(t.request.id, "PAYMENT_FAILED");
    expect(entries).toHaveLength(1);
    expect(entries[0].details).toMatchObject({ reason: "MISMATCH", paymentId: t.payment.id });
    const rows = await prisma.notification.findMany({
      where: { type: "PRINT_REQUEST_STATUS_CHANGED", userId: t.staffAdmin.id },
    });
    expect(rows[0]).toMatchObject({ title: `Paiement à vérifier : ${t.request.reference}` });
  });

  it("MISMATCH : échec de la notification → l'issue est conservée", async () => {
    const t = await seed();
    fetchMock.mockResolvedValue(txResponse("approved", 149000));
    const triggers = await import("@/lib/notifications/triggers");
    vi.spyOn(triggers, "notifyPrintPaymentUnmatched").mockRejectedValue(new Error("boom"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await confirmPayment(77)).toEqual({ status: "DECLINED", applied: false });
    expect(errorSpy).toHaveBeenCalledWith("[payment] notification apres paiement en echec", expect.any(Error));
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: t.payment.id } })).status).toBe("DECLINED");
  });

  it("deux refus concurrents → une seule entrée PAYMENT_FAILED et un seul journal", async () => {
    const t = await seed();
    fetchMock.mockImplementation(async () => txResponse("declined"));
    await Promise.all([confirmPayment(77), confirmPayment(77)]);
    expect(await thread(t.request.id, "PAYMENT_FAILED")).toHaveLength(1);
    expect(await prisma.activityLog.count({ where: { type: "PAYMENT_FAILED", targetId: t.payment.id } })).toBe(1);
  });

  it("paiement CANCELED : refus ou attente chez FedaPay → rien ne change", async () => {
    const t = await seed();
    await prisma.payment.update({ where: { id: t.payment.id }, data: { status: "CANCELED" } });
    for (const status of ["declined", "pending"]) {
      fetchMock.mockResolvedValue(txResponse(status));
      expect(await confirmPayment(77)).toEqual({ status: "CANCELED", applied: false });
    }
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: t.payment.id } })).status).toBe("CANCELED");
    expect(await thread(t.request.id, "PAYMENT_FAILED")).toHaveLength(0);
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}
const TOKEN_URL = "https://pay.fedapay.com/t88";

// Routeur de fetch : GET/POST par chemin, avec temporisation optionnelle de la création.
function routeFetch(
  fetchMock: ReturnType<typeof vi.fn>,
  routes: { create?: () => Response | Promise<Response>; retrieve?: Record<number, () => Response>; token?: () => Response },
) {
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname.replace(/^\/v1/, "");
    if (init.method === "POST" && path === "/transactions") {
      return (routes.create ?? (() => txResponse("pending", 150000, 88)))();
    }
    if (init.method === "POST" && /^\/transactions\/\d+\/token$/.test(path)) {
      return (routes.token ?? (() => jsonResponse({ "v1/token": { url: TOKEN_URL } })))();
    }
    const id = Number(path.split("/")[2]);
    return (routes.retrieve?.[id] ?? (() => jsonResponse({}, 500)))();
  });
}

async function seedAccepted(over: { status?: "QUOTED"; acceptedTotal?: number | null; reference?: string } = {}) {
  const fx = await seedAcceptedPrintRequest({ total: 150000 });
  await prisma.event.update({ where: { id: fx.event.id }, data: { title: "Salon Test" } });
  const request = await prisma.printRequest.update({
    where: { id: fx.request.id },
    data: { reference: over.reference ?? "IMP-2026-0042", ...(over.status ? { status: over.status } : {}),
      ...("acceptedTotal" in over ? { acceptedTotal: over.acceptedTotal } : {}) },
  });
  return { ...fx, request };
}

const paymentsOf = (requestId: string) => prisma.payment.findMany({ where: { printRequestId: requestId } });
const pendingPayment = (
  t: Awaited<ReturnType<typeof seedAccepted>>,
  over: { txId?: number | null; createdAt?: Date } = {},
) =>
  prisma.payment.create({
    data: {
      orgId: t.org.id, purpose: "PRINT_REQUEST", printRequestId: t.request.id, userId: t.owner.id,
      amount: 150000, status: "PENDING", fedapayTransactionId: over.txId === undefined ? 88 : over.txId,
      ...(over.createdAt ? { createdAt: over.createdAt } : {}),
    },
  });
const input = (t: Awaited<ReturnType<typeof seedAccepted>>) => ({
  orgId: t.org.id, eventId: t.event.id, requestId: t.request.id, userId: t.owner.id,
});

describe("startPrintRequestCheckout", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("FEDAPAY_ENVIRONMENT", "sandbox");
    vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_test");
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "wh");
    vi.stubEnv("NEXTAUTH_URL", "https://badge.local/");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const rejects = (promise: Promise<unknown>, code: string, httpStatus: number) =>
    expect(promise).rejects.toMatchObject({ code, httpStatus, name: PaymentError.name });

  it("crée un Payment PRINT_REQUEST PENDING de 150 000 FCFA et renvoie l'URL FedaPay", async () => {
    const t = await seedAccepted();
    routeFetch(fetchMock, {});
    const res = await startPrintRequestCheckout(input(t));
    expect(res.url).toBe(TOKEN_URL);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: res.paymentId } });
    expect(payment).toMatchObject({
      purpose: "PRINT_REQUEST", planId: null, printRequestId: t.request.id, amount: 150000,
      status: "PENDING", fedapayTransactionId: 88, fedapayReference: "trx_88", userId: t.owner.id, orgId: t.org.id,
    });
    const post = fetchMock.mock.calls.find(([, init]) => init.method === "POST" && String(init.body).includes("amount"));
    expect(JSON.parse(post![1].body)).toMatchObject({
      description: "Impression IMP-2026-0042 — Salon Test",
      callback_url: `https://badge.local/event/${t.event.id}/print/${t.request.id}/return`,
      custom_metadata: { paymentId: res.paymentId, printRequestId: t.request.id },
    });
  });

  it("log PAYMENT_INITIATED avec purpose PRINT_REQUEST, printRequestId et amount 150000", async () => {
    const t = await seedAccepted();
    routeFetch(fetchMock, {});
    const { paymentId } = await startPrintRequestCheckout(input(t));
    const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "PAYMENT_INITIATED", targetId: paymentId } });
    expect(log.details).toMatchObject({
      paymentId, purpose: "PRINT_REQUEST", printRequestId: t.request.id, amount: 150000,
    });
  });

  it("demande QUOTED → REQUEST_NOT_PAYABLE (409), aucun Payment", async () => {
    const t = await seedAccepted({ status: "QUOTED" });
    await rejects(startPrintRequestCheckout(input(t)), "REQUEST_NOT_PAYABLE", 409);
    expect(await paymentsOf(t.request.id)).toHaveLength(0);
  });

  it("acceptedTotal null → REQUEST_NOT_PAYABLE", async () => {
    const t = await seedAccepted({ acceptedTotal: null });
    await rejects(startPrintRequestCheckout(input(t)), "REQUEST_NOT_PAYABLE", 409);
    const zero = await seedAccepted({ acceptedTotal: 0, reference: "IMP-2026-0043" });
    await rejects(startPrintRequestCheckout(input(zero)), "REQUEST_NOT_PAYABLE", 409);
  });

  it("demande d'un autre évènement ou inconnue → REQUEST_NOT_FOUND (404)", async () => {
    const t = await seedAccepted();
    const other = await seedAccepted({ reference: "IMP-2026-0044" });
    await rejects(startPrintRequestCheckout({ ...input(t), eventId: other.event.id }), "REQUEST_NOT_FOUND", 404);
    await rejects(startPrintRequestCheckout({ ...input(t), orgId: other.org.id }), "REQUEST_NOT_FOUND", 404);
    await rejects(startPrintRequestCheckout({ ...input(t), requestId: "inconnue" }), "REQUEST_NOT_FOUND", 404);
  });

  it("FedaPay non configuré → PAYMENTS_DISABLED, aucun Payment", async () => {
    const t = await seedAccepted();
    vi.stubEnv("FEDAPAY_SECRET_KEY", "");
    await rejects(startPrintRequestCheckout(input(t)), "PAYMENTS_DISABLED", 503);
    expect(await paymentsOf(t.request.id)).toHaveLength(0);
  });

  it("erreur FedaPay à la création → Payment CANCELED, PROVIDER_ERROR", async () => {
    const t = await seedAccepted();
    routeFetch(fetchMock, { create: () => jsonResponse({}, 500) });
    await rejects(startPrintRequestCheckout(input(t)), "PROVIDER_ERROR", 502);
    const payments = await paymentsOf(t.request.id);
    expect(payments).toHaveLength(1);
    expect(payments[0].status).toBe("CANCELED");
  });

  it("PENDING existant encore pending chez FedaPay → même paymentId, nouvelle URL, 1 seul Payment", async () => {
    const t = await seedAccepted();
    const existing = await pendingPayment(t);
    routeFetch(fetchMock, { retrieve: { 88: () => txResponse("pending", 150000, 88) } });
    const res = await startPrintRequestCheckout(input(t));
    expect(res).toEqual({ paymentId: existing.id, url: TOKEN_URL });
    expect(await paymentsOf(t.request.id)).toHaveLength(1);
    expect(fetchMock.mock.calls.map(([u, i]) => `${i.method} ${new URL(u).pathname}`)).toEqual([
      "GET /v1/transactions/88", "POST /v1/transactions/88/token",
    ]);
  });

  it("erreur FedaPay à la lecture ou au jeton du paiement existant → PROVIDER_ERROR, paiement conservé", async () => {
    const t = await seedAccepted();
    const existing = await pendingPayment(t);
    routeFetch(fetchMock, {});
    await rejects(startPrintRequestCheckout(input(t)), "PROVIDER_ERROR", 502);
    routeFetch(fetchMock, { retrieve: { 88: () => txResponse("pending", 150000, 88) }, token: () => jsonResponse({}, 500) });
    await rejects(startPrintRequestCheckout(input(t)), "PROVIDER_ERROR", 502);
    routeFetch(fetchMock, { retrieve: { 88: () => txResponse("declined", 150000, 88) } });
    fetchMock.mockImplementationOnce(async () => txResponse("declined", 150000, 88)).mockImplementationOnce(async () => jsonResponse({}, 500));
    await rejects(startPrintRequestCheckout(input(t)), "PROVIDER_ERROR", 502);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: existing.id } })).status).toBe("PENDING");
  });

  it("paiement existant incohérent (plan et demande) → PROVIDER_ERROR", async () => {
    const t = await seedAccepted();
    const plan = await prisma.plan.create({ data: { name: "pro-incoherent", price: 15000 } });
    const bad = await pendingPayment(t);
    await prisma.payment.update({ where: { id: bad.id }, data: { planId: plan.id } });
    routeFetch(fetchMock, { retrieve: { 88: () => txResponse("declined", 150000, 88) } });
    await rejects(startPrintRequestCheckout(input(t)), "PROVIDER_ERROR", 502);
  });

  it("PENDING existant refusé chez FedaPay → ancien DECLINED, nouveau Payment PENDING", async () => {
    const t = await seedAccepted();
    const old = await pendingPayment(t, { txId: 55 });
    routeFetch(fetchMock, { retrieve: { 55: () => txResponse("declined", 150000, 55) } });
    const res = await startPrintRequestCheckout(input(t));
    expect(res.paymentId).not.toBe(old.id);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("DECLINED");
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: res.paymentId } }))).toMatchObject({
      status: "PENDING", fedapayTransactionId: 88,
    });
  });

  it("PENDING existant approuvé chez FedaPay → demande PAID, REQUEST_NOT_PAYABLE", async () => {
    const t = await seedAccepted();
    const old = await pendingPayment(t);
    routeFetch(fetchMock, { retrieve: { 88: () => txResponse("approved", 150000, 88) } });
    await rejects(startPrintRequestCheckout(input(t)), "REQUEST_NOT_PAYABLE", 409);
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: t.request.id } }))).toMatchObject({
      status: "PAID", paidPaymentId: old.id,
    });
    expect(await paymentsOf(t.request.id)).toHaveLength(1);
  });

  it("PENDING existant introuvable chez FedaPay (404) → ancien CANCELED (REPLACED), nouveau Payment", async () => {
    const t = await seedAccepted();
    const old = await pendingPayment(t, { txId: 55 });
    routeFetch(fetchMock, { retrieve: { 55: () => jsonResponse({}, 404) } });
    const res = await startPrintRequestCheckout(input(t));
    expect(res.paymentId).not.toBe(old.id);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("CANCELED");
    const entries = await prisma.printRequestMessage.findMany({
      where: { requestId: t.request.id, eventType: "PAYMENT_FAILED" },
    });
    expect(entries[0].details).toMatchObject({ reason: "REPLACED", paymentId: old.id });
  });

  it("l'ancien paiement REPLACED, approuvé ensuite chez FedaPay, donne PAID tant que la demande est ACCEPTED", async () => {
    const t = await seedAccepted();
    const old = await pendingPayment(t, { txId: 55 });
    routeFetch(fetchMock, { retrieve: { 55: () => jsonResponse({}, 404) } });
    await startPrintRequestCheckout(input(t));
    routeFetch(fetchMock, { retrieve: { 55: () => txResponse("approved", 150000, 55) } });
    expect(await confirmPayment(55)).toEqual({ status: "APPROVED", applied: true });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("APPROVED");
  });

  it("erreur non FedaPay à la lecture du paiement existant → PROVIDER_ERROR", async () => {
    const t = await seedAccepted();
    await pendingPayment(t);
    fetchMock.mockImplementation(async () => {
      throw new TypeError("boom");
    });
    // Le client FedaPay encapsule les erreurs reseau : on force une erreur brute au niveau du module.
    const fedapay = await import("@/lib/fedapay");
    vi.spyOn(fedapay, "retrieveTransaction").mockRejectedValue(new TypeError("boom"));
    await rejects(startPrintRequestCheckout(input(t)), "PROVIDER_ERROR", 502);
  });

  it("paiement existant d'un autre montant que le devis accepté → CANCELED (REPLACED), nouveau Payment", async () => {
    const t = await seedAccepted();
    const old = await pendingPayment(t, { txId: 55 });
    await prisma.payment.update({ where: { id: old.id }, data: { amount: 120000 } });
    routeFetch(fetchMock, {});
    const res = await startPrintRequestCheckout(input(t));
    expect(res.paymentId).not.toBe(old.id);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("CANCELED");
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: res.paymentId } })).amount).toBe(150000);
    const entries = await prisma.printRequestMessage.findMany({
      where: { requestId: t.request.id, eventType: "PAYMENT_FAILED" },
    });
    expect(entries[0].details).toMatchObject({ reason: "REPLACED", paymentId: old.id });
  });

  it("utilisateur introuvable → échec avant toute création de Payment", async () => {
    const t = await seedAccepted();
    await expect(startPrintRequestCheckout({ ...input(t), userId: "inconnu" })).rejects.toThrow();
    expect(await paymentsOf(t.request.id)).toHaveLength(0);
  });

  it("P1 remplacé puis P2 créé : P1 approuvé tard → PAID ; P2 approuvé ensuite → UNMATCHED et alerte staff", async () => {
    const t = await seedAccepted();
    const p1 = await pendingPayment(t, { txId: 55 });
    routeFetch(fetchMock, { retrieve: { 55: () => jsonResponse({}, 404) } });
    const { paymentId: p2 } = await startPrintRequestCheckout(input(t));
    const status = async () => (await prisma.printRequest.findUniqueOrThrow({ where: { id: t.request.id } })).status;
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p1.id } })).status).toBe("CANCELED");
    expect(await status()).toBe("ACCEPTED");

    routeFetch(fetchMock, { retrieve: { 55: () => txResponse("approved", 150000, 55), 88: () => txResponse("approved", 150000, 88) } });
    expect(await confirmPayment(55)).toEqual({ status: "APPROVED", applied: true });
    expect(await status()).toBe("PAID");

    expect(await confirmPayment(88)).toEqual({ status: "APPROVED", applied: false });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p2 } })).status).toBe("APPROVED");
    expect(await status()).toBe("PAID");
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: t.request.id } })).paidPaymentId).toBe(p1.id);
    const unmatched = await prisma.printRequestMessage.findMany({
      where: { requestId: t.request.id, eventType: "PAYMENT_UNMATCHED" },
    });
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].details).toMatchObject({ paymentId: p2 });
    const rows = await prisma.notification.findMany({
      where: { type: "PRINT_REQUEST_STATUS_CHANGED", userId: t.staffAdmin.id, title: { startsWith: "Paiement à vérifier" } },
    });
    expect(rows).toHaveLength(1);
  });

  it("deux checkouts voient le même 404 → une seule entrée REPLACED et un seul journal", async () => {
    const t = await seedAccepted();
    const old = await pendingPayment(t, { txId: 55 });
    routeFetch(fetchMock, { retrieve: { 55: () => jsonResponse({}, 404) } });
    await Promise.allSettled([startPrintRequestCheckout(input(t)), startPrintRequestCheckout(input(t))]);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("CANCELED");
    const entries = await prisma.printRequestMessage.findMany({
      where: { requestId: t.request.id, eventType: "PAYMENT_FAILED" },
    });
    expect(entries.filter((e) => (e.details as { paymentId?: string }).paymentId === old.id)).toHaveLength(1);
    expect(await prisma.activityLog.count({ where: { type: "PAYMENT_FAILED", targetId: old.id } })).toBe(1);
  });

  it("PENDING sans transaction créé il y a 30 s → PAYMENT_IN_PROGRESS", async () => {
    const t = await seedAccepted();
    await pendingPayment(t, { txId: null, createdAt: new Date(Date.now() - 30_000) });
    await rejects(startPrintRequestCheckout(input(t)), "PAYMENT_IN_PROGRESS", 409);
    expect(await paymentsOf(t.request.id)).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("PENDING sans transaction créé il y a 5 min → ancien CANCELED, nouveau Payment", async () => {
    const t = await seedAccepted();
    const old = await pendingPayment(t, { txId: null, createdAt: new Date(Date.now() - 5 * 60_000) });
    routeFetch(fetchMock, {});
    const res = await startPrintRequestCheckout(input(t));
    expect(res.paymentId).not.toBe(old.id);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("CANCELED");
  });

  it("deux checkouts concurrents (Promise.all) → un seul Payment avec transaction, l'autre PAYMENT_IN_PROGRESS", async () => {
    const t = await seedAccepted();
    routeFetch(fetchMock, {
      create: async () => {
        await new Promise((r) => setTimeout(r, 300));
        return txResponse("pending", 150000, 88);
      },
    });
    const results = await Promise.allSettled([startPrintRequestCheckout(input(t)), startPrintRequestCheckout(input(t))]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(failed.reason).toMatchObject({ code: "PAYMENT_IN_PROGRESS" });
    const payments = await paymentsOf(t.request.id);
    expect(payments).toHaveLength(1);
    expect(payments[0].fedapayTransactionId).toBe(88);
  });

  it("la reprise n'a lieu qu'une fois : deux paiements PENDING refusés de suite → PAYMENT_IN_PROGRESS", async () => {
    const t = await seedAccepted();
    await pendingPayment(t, { txId: 55, createdAt: new Date(Date.now() - 1000) });
    await pendingPayment(t, { txId: 56 });
    routeFetch(fetchMock, {
      retrieve: { 55: () => txResponse("declined", 150000, 55), 56: () => txResponse("declined", 150000, 56) },
    });
    await rejects(startPrintRequestCheckout(input(t)), "PAYMENT_IN_PROGRESS", 409);
    expect(await prisma.payment.count({ where: { printRequestId: t.request.id, status: "DECLINED" } })).toBe(2);
  });
});
