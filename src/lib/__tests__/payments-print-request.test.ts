import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { confirmPayment } from "@/lib/payments";
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
});
