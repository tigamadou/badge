import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resolvePaymentReturn } from "@/lib/payment-return";
import { confirmPayment } from "@/lib/payments";

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
