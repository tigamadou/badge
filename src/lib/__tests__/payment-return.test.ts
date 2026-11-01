import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resolvePaymentReturn, resolvePrintPaymentReturn } from "@/lib/payment-return";
import { appendThreadEvent } from "@/lib/print-requests/thread";
import { confirmPayment } from "@/lib/payments";
import { seedAcceptedPrintRequest } from "./helpers/print-requests";

// Enveloppe transparente : permet de simuler un paiement disparu entre la lecture et la confirmation.
vi.mock("@/lib/payments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/payments")>();
  return { ...actual, confirmPayment: vi.fn(actual.confirmPayment) };
});

function txResponse(status: string, amount = 15000) {
  return new Response(
    JSON.stringify({
      "v1/transaction": { id: 77, reference: "trx_77", amount, status, currency: { iso: "XOF" } },
    }),
    { status: 200 },
  );
}

async function seed() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const user = await prisma.user.create({ data: { email: `r-${stamp}@x.test`, password: "x", name: "Payeur" } });
  const org = await prisma.organization.create({ data: { name: "Org R", slug: `rt-${stamp}` } });
  const other = await prisma.organization.create({ data: { name: "Autre", slug: `rt2-${stamp}` } });
  await prisma.orgMembership.create({ data: { userId: user.id, orgId: org.id, role: "OWNER" } });
  const pro = await prisma.plan.create({ data: { name: "pro", price: 15000 } });
  const basic = await prisma.plan.create({ data: { name: "basic", price: 5000 } });
  const payment = await prisma.payment.create({
    data: { orgId: org.id, planId: pro.id, userId: user.id, amount: 15000, status: "PENDING", fedapayTransactionId: 77 },
  });
  return { user, org, other, pro, basic, payment };
}

describe("resolvePaymentReturn", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
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

  it("paiement d'une autre organisation : NOT_FOUND sans appel FedaPay", async () => {
    const { other } = await seed();
    const res = await resolvePaymentReturn(other.id, "77");
    expect(res).toEqual({ outcome: "NOT_FOUND", planName: "", activationDate: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("paiement PRINT_REQUEST de la même org → NOT_FOUND sans confirmPayment", async () => {
    const { org, user } = await seed();
    const fx = await seedAcceptedPrintRequest({ orgId: org.id, userId: user.id });
    await prisma.payment.create({
      data: {
        orgId: org.id, purpose: "PRINT_REQUEST", printRequestId: fx.request.id, userId: user.id,
        amount: 5000, status: "PENDING", fedapayTransactionId: 78,
      },
    });
    vi.mocked(confirmPayment).mockClear();
    const res = await resolvePaymentReturn(org.id, "78");
    expect(res).toEqual({ outcome: "NOT_FOUND", planName: "", activationDate: null });
    expect(confirmPayment).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("paiement inconnu : NOT_FOUND", async () => {
    const { org } = await seed();
    expect((await resolvePaymentReturn(org.id, "999")).outcome).toBe("NOT_FOUND");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("id absent ou non entier : NOT_FOUND", async () => {
    const { org } = await seed();
    expect((await resolvePaymentReturn(org.id, undefined)).outcome).toBe("NOT_FOUND");
    expect((await resolvePaymentReturn(org.id, "abc")).outcome).toBe("NOT_FOUND");
    expect((await resolvePaymentReturn(org.id, "7.5")).outcome).toBe("NOT_FOUND");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("approuvé en mode IMMEDIATE : APPROVED", async () => {
    const { org } = await seed();
    fetchMock.mockResolvedValue(txResponse("approved"));
    const res = await resolvePaymentReturn(org.id, "77");
    expect(res).toEqual({ outcome: "APPROVED", planName: "pro", activationDate: null });
  });

  it("approuvé en mode SCHEDULED : SCHEDULED avec la date de fin d'abonnement", async () => {
    const { org, pro, basic } = await seed();
    const endDate = new Date(Date.now() + 10 * 86400000);
    await prisma.subscription.create({
      data: { orgId: org.id, planId: pro.id, status: "ACTIVE", startDate: new Date(), endDate },
    });
    await prisma.payment.update({
      where: { fedapayTransactionId: 77 },
      data: { planId: basic.id, amount: basic.price! },
    });
    fetchMock.mockResolvedValue(txResponse("approved", basic.price!));
    const res = await resolvePaymentReturn(org.id, "77");
    expect(res.outcome).toBe("SCHEDULED");
    expect(res.planName).toBe("basic");
    expect(res.activationDate).toEqual(endDate);
  });

  it("refusé : FAILED", async () => {
    const { org } = await seed();
    fetchMock.mockResolvedValue(txResponse("declined"));
    expect((await resolvePaymentReturn(org.id, "77")).outcome).toBe("FAILED");
  });

  it("encore en attente chez FedaPay : PENDING", async () => {
    const { org } = await seed();
    fetchMock.mockResolvedValue(txResponse("pending"));
    expect((await resolvePaymentReturn(org.id, "77")).outcome).toBe("PENDING");
  });

  it("paiement EXPIRED approuvé ensuite par FedaPay : APPROVED", async () => {
    const { org } = await seed();
    await prisma.payment.update({ where: { fedapayTransactionId: 77 }, data: { status: "EXPIRED" } });
    fetchMock.mockResolvedValue(txResponse("approved"));
    expect((await resolvePaymentReturn(org.id, "77")).outcome).toBe("APPROVED");
  });

  it("paiement EXPIRED encore en attente chez FedaPay : PENDING", async () => {
    const { org } = await seed();
    await prisma.payment.update({ where: { fedapayTransactionId: 77 }, data: { status: "EXPIRED" } });
    fetchMock.mockResolvedValue(txResponse("pending"));
    expect((await resolvePaymentReturn(org.id, "77")).outcome).toBe("PENDING");
  });

  it("erreur FedaPay : PENDING et erreur journalisée", async () => {
    const { org } = await seed();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    const res = await resolvePaymentReturn(org.id, "77");
    expect(res.outcome).toBe("PENDING");
    expect(err).toHaveBeenCalledWith("[return fedapay]", expect.anything());
  });

  it("paiement disparu pendant la confirmation : NOT_FOUND", async () => {
    const { org } = await seed();
    vi.mocked(confirmPayment).mockResolvedValueOnce(null);
    expect((await resolvePaymentReturn(org.id, "77")).outcome).toBe("NOT_FOUND");
  });

  it("SCHEDULED sans abonnement : date d'activation nulle", async () => {
    const { org } = await seed();
    await prisma.payment.update({
      where: { fedapayTransactionId: 77 },
      data: { status: "APPROVED", mode: "SCHEDULED" },
    });
    const res = await resolvePaymentReturn(org.id, "77");
    expect(res).toEqual({ outcome: "SCHEDULED", planName: "pro", activationDate: null });
  });
});

describe("resolvePrintPaymentReturn", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("FEDAPAY_ENVIRONMENT", "sandbox");
    vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_test");
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "wh");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(confirmPayment).mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function seedPrint(txId = 77) {
    const fx = await seedAcceptedPrintRequest({ total: 150000 });
    await prisma.printRequest.update({ where: { id: fx.request.id }, data: { reference: `IMP-2026-${txId}` } });
    const payment = await prisma.payment.create({
      data: {
        orgId: fx.org.id, purpose: "PRINT_REQUEST", printRequestId: fx.request.id, userId: fx.owner.id,
        amount: 150000, status: "PENDING", fedapayTransactionId: txId,
      },
    });
    return { ...fx, payment };
  }
  // Contexte de la page : évènement et organisation de la demande.
  const call = (requestId: string, rawId: string | undefined, over: { eventId?: string; orgId?: string } = {}) =>
    prisma.printRequest
      .findUniqueOrThrow({ where: { id: requestId }, select: { eventId: true, orgId: true } })
      .then((r) => resolvePrintPaymentReturn({ requestId, eventId: r.eventId, orgId: r.orgId, rawId, ...over }));
  const notFound = { outcome: "NOT_FOUND", reference: "", amount: 0 };

  it("approuvé → PAID avec la référence et le montant", async () => {
    const t = await seedPrint();
    await prisma.printRequest.update({ where: { id: t.request.id }, data: { reference: "IMP-2026-0042" } });
    fetchMock.mockResolvedValue(txResponse("approved", 150000));
    expect(await call(t.request.id, "77")).toEqual({
      outcome: "PAID", reference: "IMP-2026-0042", amount: 150000,
    });
  });

  it("demande déjà avancée après le paiement (paidPaymentId posé) → PAID", async () => {
    const t = await seedPrint();
    fetchMock.mockResolvedValue(txResponse("approved", 150000));
    await confirmPayment(77);
    await prisma.printRequest.update({ where: { id: t.request.id }, data: { status: "IN_PRODUCTION" } });
    expect((await call(t.request.id, "77")).outcome).toBe("PAID");
  });

  it("approuvé tardivement sur une demande QUOTED → UNMATCHED", async () => {
    const t = await seedPrint();
    await prisma.printRequest.update({ where: { id: t.request.id }, data: { status: "QUOTED" } });
    fetchMock.mockResolvedValue(txResponse("approved", 150000));
    const res = await call(t.request.id, "77");
    expect(res).toMatchObject({ outcome: "UNMATCHED", amount: 150000 });
  });

  it("approuvé sur une demande PAID à la main (paidPaymentId nul) → UNMATCHED", async () => {
    const t = await seedPrint();
    await prisma.printRequest.update({
      where: { id: t.request.id }, data: { status: "PAID", paidAt: new Date(), paidPaymentId: null },
    });
    fetchMock.mockResolvedValue(txResponse("approved", 150000));
    expect((await call(t.request.id, "77")).outcome).toBe("UNMATCHED");
  });

  it("refusé → FAILED", async () => {
    const t = await seedPrint();
    fetchMock.mockResolvedValue(txResponse("declined", 150000));
    expect((await call(t.request.id, "77")).outcome).toBe("FAILED");
  });

  it("en attente chez FedaPay → PENDING", async () => {
    const t = await seedPrint();
    fetchMock.mockResolvedValue(txResponse("pending", 150000));
    expect((await call(t.request.id, "77")).outcome).toBe("PENDING");
  });

  it("paiement EXPIRED encore en attente chez FedaPay → PENDING", async () => {
    const t = await seedPrint();
    await prisma.payment.update({ where: { id: t.payment.id }, data: { status: "EXPIRED" } });
    fetchMock.mockResolvedValue(txResponse("pending", 150000));
    expect((await call(t.request.id, "77")).outcome).toBe("PENDING");
  });

  it("retrieveTransaction en erreur → PENDING, erreur journalisée", async () => {
    const t = await seedPrint();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    const res = await call(t.request.id, "77");
    expect(res).toMatchObject({ outcome: "PENDING", amount: 150000 });
    expect(err).toHaveBeenCalledWith("[return fedapay]", expect.anything());
  });

  it("paiement d'une autre demande → NOT_FOUND sans confirmPayment", async () => {
    await seedPrint();
    const other = await seedPrint(78);
    expect(await call(other.request.id, "77")).toEqual(notFound);
    expect(confirmPayment).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("demande d'un autre évènement ou d'une autre organisation → NOT_FOUND sans appel", async () => {
    const t = await seedPrint();
    const o = await seedPrint(80);
    expect(await call(t.request.id, "77", { eventId: o.event.id })).toEqual(notFound);
    expect(await call(t.request.id, "77", { orgId: o.org.id })).toEqual(notFound);
    expect(confirmPayment).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("montant inattendu (DECLINED, raison MISMATCH) → MISMATCH", async () => {
    const t = await seedPrint();
    fetchMock.mockResolvedValue(txResponse("approved", 149000));
    expect(await call(t.request.id, "77")).toMatchObject({ outcome: "MISMATCH", amount: 150000 });
  });

  it("refus avec une entrée d'un autre paiement ou d'une autre raison → FAILED", async () => {
    const t = await seedPrint();
    await appendThreadEvent(prisma, t.request.id, "PAYMENT_FAILED", { paymentId: "autre", reason: "MISMATCH" });
    fetchMock.mockResolvedValue(txResponse("declined", 150000));
    expect((await call(t.request.id, "77")).outcome).toBe("FAILED");
  });

  it("en attente chez FedaPay → PENDING", async () => {
    const t = await seedPrint();
    fetchMock.mockResolvedValue(txResponse("pending", 150000));
    expect((await call(t.request.id, "77")).outcome).toBe("PENDING");
  });

  it("paiement EXPIRED encore en attente chez FedaPay → PENDING", async () => {
    const t = await seedPrint();
    await prisma.payment.update({ where: { id: t.payment.id }, data: { status: "EXPIRED" } });
    fetchMock.mockResolvedValue(txResponse("pending", 150000));
    expect((await call(t.request.id, "77")).outcome).toBe("PENDING");
  });

  it("retrieveTransaction en erreur → PENDING, erreur journalisée", async () => {
    const t = await seedPrint();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    const res = await call(t.request.id, "77");
    expect(res).toMatchObject({ outcome: "PENDING", amount: 150000 });
    expect(err).toHaveBeenCalledWith("[return fedapay]", expect.anything());
  });

  it("paiement SUBSCRIPTION → NOT_FOUND sans confirmPayment", async () => {
    const { payment } = await seed();
    const t = await seedPrint(79);
    expect(payment.fedapayTransactionId).toBe(77);
    expect(await call(t.request.id, "77")).toEqual(notFound);
    expect(confirmPayment).not.toHaveBeenCalled();
  });

  it("paiement inconnu → NOT_FOUND", async () => {
    const t = await seedPrint();
    expect(await call(t.request.id, "999")).toEqual(notFound);
  });

  it("id absent ou non entier → NOT_FOUND", async () => {
    const t = await seedPrint();
    expect(await call(t.request.id, undefined)).toEqual(notFound);
    expect(await call(t.request.id, "abc")).toEqual(notFound);
    expect(confirmPayment).not.toHaveBeenCalled();
  });

  it("paiement disparu pendant la confirmation → NOT_FOUND", async () => {
    const t = await seedPrint();
    vi.mocked(confirmPayment).mockResolvedValueOnce(null);
    expect(await call(t.request.id, "77")).toEqual(notFound);
  });
});
