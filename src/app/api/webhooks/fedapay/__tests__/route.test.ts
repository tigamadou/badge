import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { POST } from "../route";
import { seedAcceptedPrintRequest } from "@/lib/__tests__/helpers/print-requests";

const SECRET = "whsec_test";

function sign(body: string, secret = SECRET, t = Math.floor(Date.now() / 1000)) {
  const s = createHmac("sha256", secret).update(`${t}.${body}`, "utf8").digest("hex");
  return `t=${t},s=${s}`;
}

function req(body: string, header: string | null) {
  return new NextRequest("http://localhost/api/webhooks/fedapay", {
    method: "POST",
    body,
    headers: header ? { "x-fedapay-signature": header } : {},
  });
}

function signed(event: unknown) {
  const body = JSON.stringify(event);
  return req(body, sign(body));
}

function txResponse(status: string, amount = 15000) {
  return new Response(
    JSON.stringify({
      "v1/transaction": { id: 77, reference: "trx_77", amount, status, currency: { iso: "XOF" } },
    }),
    { status: 200 },
  );
}

async function seedPayment() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const user = await prisma.user.create({ data: { email: `w-${stamp}@x.test`, password: "x", name: "Payeur" } });
  const org = await prisma.organization.create({ data: { name: "Org W", slug: `wh-${stamp}` } });
  await prisma.orgMembership.create({ data: { userId: user.id, orgId: org.id, role: "OWNER" } });
  const pro = await prisma.plan.create({ data: { name: "pro", price: 15000 } });
  const payment = await prisma.payment.create({
    data: { orgId: org.id, planId: pro.id, userId: user.id, amount: 15000, status: "PENDING", fedapayTransactionId: 77 },
  });
  return { payment, org };
}

describe("POST /api/webhooks/fedapay", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.stubEnv("FEDAPAY_ENVIRONMENT", "sandbox");
    vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_test");
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", SECRET);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("applique le paiement sur transaction.approved et répond 200", async () => {
    const { payment } = await seedPayment();
    fetchMock.mockResolvedValue(txResponse("approved"));

    const res = await POST(signed({ name: "transaction.approved", entity: { id: 77 } }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("APPROVED");
  });

  it("transaction.approved sur un paiement d'abonnement remplacé (CANCELED) : appliqué", async () => {
    const { payment, org } = await seedPayment();
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "CANCELED" } });
    fetchMock.mockResolvedValue(txResponse("approved"));

    const res = await POST(signed({ name: "transaction.approved", entity: { id: 77 } }));

    expect(res.status).toBe(200);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("APPROVED");
    expect(await prisma.subscription.count({ where: { orgId: org.id } })).toBe(1);
  });

  it("rejoué : 200 et une seule application", async () => {
    const { payment, org } = await seedPayment();
    fetchMock.mockResolvedValue(txResponse("approved"));
    const event = { name: "transaction.approved", entity: { id: 77 } };

    await POST(signed(event));
    const res = await POST(signed(event));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await prisma.activityLog.count({ where: { type: "PAYMENT_APPROVED", targetId: payment.id } })).toBe(1);
    expect(await prisma.subscription.count({ where: { orgId: org.id } })).toBe(1);
  });

  it("transaction.approved d'un paiement d'impression → commande PAID, 200", async () => {
    const fx = await seedAcceptedPrintRequest({ total: 150000 });
    const payment = await prisma.payment.create({
      data: {
        orgId: fx.org.id, purpose: "PRINT_REQUEST", printRequestId: fx.request.id, userId: fx.owner.id,
        amount: 150000, status: "PENDING", fedapayTransactionId: 77,
      },
    });
    fetchMock.mockResolvedValue(txResponse("approved", 150000));

    const res = await POST(signed({ name: "transaction.approved", entity: { id: 77 } }));

    expect(res.status).toBe(200);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("APPROVED");
    const request = await prisma.printRequest.findUniqueOrThrow({ where: { id: fx.request.id } });
    expect(request.status).toBe("PAID");
    expect(request.paidPaymentId).toBe(payment.id);
  });

  it("rejoué → 200, une seule entrée « Paiement reçu »", async () => {
    const fx = await seedAcceptedPrintRequest({ total: 150000 });
    await prisma.payment.create({
      data: {
        orgId: fx.org.id, purpose: "PRINT_REQUEST", printRequestId: fx.request.id, userId: fx.owner.id,
        amount: 150000, status: "PENDING", fedapayTransactionId: 77,
      },
    });
    fetchMock.mockResolvedValue(txResponse("approved", 150000));
    const event = { name: "transaction.approved", entity: { id: 77 } };

    await POST(signed(event));
    const res = await POST(signed(event));

    expect(res.status).toBe(200);
    expect(await prisma.printRequestMessage.count({
      where: { requestId: fx.request.id, eventType: "PAYMENT_RECEIVED" },
    })).toBe(1);
  });

  it("signature invalide : 400 et rien n'est appliqué", async () => {
    const { payment } = await seedPayment();
    const body = JSON.stringify({ name: "transaction.approved", entity: { id: 77 } });

    const res = await POST(req(body, sign(body, "autre-secret")));

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PENDING");
  });

  it("signature absente : 400", async () => {
    const res = await POST(req("{}", null));
    expect(res.status).toBe(400);
  });

  it("évènement non transactionnel : 200 sans appel FedaPay", async () => {
    const res = await POST(signed({ name: "customer.created", entity: { id: 5 } }));
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("transaction sans id numérique : 200 sans appel FedaPay", async () => {
    const res = await POST(signed({ name: "transaction.approved", entity: { id: "77" } }));
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("évènement sans nom ni entité : 200 sans appel FedaPay", async () => {
    const res = await POST(signed({}));
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("transaction inconnue : 200", async () => {
    const res = await POST(signed({ name: "transaction.approved", entity: { id: 999 } }));
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("FedaPay non configuré : 503", async () => {
    vi.stubEnv("FEDAPAY_SECRET_KEY", "");
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "");
    const res = await POST(signed({ name: "transaction.approved", entity: { id: 77 } }));
    expect(res.status).toBe(503);
  });

  it("erreur FedaPay à la relecture : 200 et paiement toujours PENDING", async () => {
    const { payment } = await seedPayment();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));

    const res = await POST(signed({ name: "transaction.approved", entity: { id: 77 } }));

    expect(res.status).toBe(200);
    expect(err).toHaveBeenCalled();
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PENDING");
  });
});
