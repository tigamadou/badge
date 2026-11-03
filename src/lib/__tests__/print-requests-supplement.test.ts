import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { confirmPayment } from "@/lib/payments";
import { closeOnsiteRequest } from "@/lib/print-requests/close-onsite";
import { cancelRequest, acceptQuote } from "@/lib/print-requests/lifecycle";
import { setBadges, setOrganizerProducts, updateDetails } from "@/lib/print-requests/content";
import { applyOrgCredit, getOrgPrintCreditBalance } from "@/lib/print-requests/org-credit";
import { rejectRequest, sendQuote } from "@/lib/print-requests/quote";
import { seedPrintFixture, makeRequest, type PrintFixture } from "./helpers/print-requests";

// Commande complémentaire (surplus facturé à la clôture) : protégée côté organisateur, et payable
// avec du crédit d'impression jusqu'au bout (crédit appliqué, devis envoyé, accepté, payé).

let fx: PrintFixture;
const reject = async (p: Promise<unknown>) => p.then(() => null, (e) => e as { code: string; status: number });

// Commande sur place de 200 badges à 1 500 FCFA, 212 imprimés : clôture = 12 badges en trop (18 000).
async function closedWithSupplement() {
  const parent = await makeRequest(fx, {
    type: "ONSITE", status: "COMPLETED", estimatedQuantity: 200, marginPercent: 10, completedAt: new Date(),
    badgeTemplateId: fx.template.id, badgeWidthPx: 320, badgeHeightPx: 460, badgePages: 2,
  });
  await prisma.printQuoteLine.create({
    data: {
      requestId: parent.id, kind: "PRODUCT", productId: fx.badgeProduct.id, label: "Badge", quantity: 200,
      unitPrice: 1500, lineTotal: 300000, position: 0, addedBy: "ORGANIZER",
    },
  });
  await prisma.printRequestPrint.createMany({
    data: Array.from({ length: 212 }, () => ({ requestId: parent.id, registrationId: null, reprint: false })),
  });
  const closure = await closeOnsiteRequest(parent.id);
  if (closure.outcome !== "SUPPLEMENT") throw new Error("surplus attendu");
  return prisma.printRequest.findUniqueOrThrow({ where: { id: closure.supplementRequestId } });
}

beforeEach(async () => {
  vi.restoreAllMocks();
  fx = await seedPrintFixture();
});

describe("commande complémentaire : protégée côté organisateur", () => {
  it("l'organisateur ne l'annule ni ne la modifie (REQUEST_LOCKED 409), rien n'est écrit", async () => {
    const child = await closedWithSupplement();
    const ids = { requestId: child.id, eventId: fx.event.id, userId: fx.owner.id };
    expect(await reject(cancelRequest(ids))).toMatchObject({ code: "REQUEST_LOCKED", status: 409 });
    expect(await reject(updateDetails({ ...ids, patch: { onsiteLocation: "Autre lieu" } }))).toMatchObject({
      code: "REQUEST_LOCKED", status: 409,
    });
    expect(
      await reject(setOrganizerProducts({ ...ids, products: [{ productId: fx.badgeProduct.id, quantity: null, choices: [] }] })),
    ).toMatchObject({ code: "REQUEST_LOCKED", status: 409 });
    const advance = await reject(setBadges({ ...ids, selection: { mode: "IDS", registrationIds: [] } as never }));
    expect(advance).toMatchObject({ code: "TYPE_MISMATCH" });
    const after = await prisma.printRequest.findUniqueOrThrow({ where: { id: child.id } });
    expect(after).toMatchObject({ status: "QUOTED", cancelledAt: null, onsiteLocation: null });
  });

  it("une commande ordinaire reste annulable par l'organisateur", async () => {
    const r = await makeRequest(fx, { type: "ONSITE", status: "SUBMITTED" });
    const { request } = await cancelRequest({ requestId: r.id, eventId: fx.event.id, userId: fx.owner.id });
    expect(request.status).toBe("CANCELLED");
  });

  it("le staff garde le refus", async () => {
    const child = await closedWithSupplement();
    const rejected = await rejectRequest({ requestId: child.id, userId: fx.staffAdmin.id, reason: "Hors périmètre" });
    expect(rejected.status).toBe("REJECTED");
  });
});

describe("commande complémentaire payée avec du crédit (intégration)", () => {
  beforeEach(() => {
    vi.stubEnv("FEDAPAY_ENVIRONMENT", "sandbox");
    vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_test");
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "wh");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("crédit appliqué -> devis envoyé -> accepté par l'OWNER -> payé : PAID et mouvement SPENT", async () => {
    const child = await closedWithSupplement();
    expect(child).toMatchObject({ status: "QUOTED", total: 18000 });
    await prisma.orgPrintCredit.create({ data: { orgId: fx.org.id, kind: "EARNED", amount: 10000 } });

    const { line } = await applyOrgCredit({ requestId: child.id, amount: 10000, userId: fx.staffAdmin.id });
    expect(line).toMatchObject({ usesOrgCredit: true, lineTotal: -10000 });
    // Repassée SUBMITTED par la révision : le staff renvoie le devis, l'OWNER l'accepte.
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: child.id } })).status).toBe("SUBMITTED");
    const quoted = await sendQuote({ requestId: child.id, userId: fx.staffAdmin.id });
    expect(quoted).toMatchObject({ status: "QUOTED", total: 8000 });
    const accepted = await acceptQuote({
      requestId: child.id, eventId: fx.event.id, userId: fx.owner.id, version: quoted.quoteVersion,
    });
    expect(accepted).toMatchObject({ status: "ACCEPTED", acceptedTotal: 8000 });

    const payment = await prisma.payment.create({
      data: {
        orgId: fx.org.id, purpose: "PRINT_REQUEST", printRequestId: child.id, userId: fx.owner.id,
        amount: 8000, status: "PENDING", fedapayTransactionId: 4242,
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ "v1/transaction": { id: 4242, reference: "trx_4242", amount: 8000, status: "approved", currency: { iso: "XOF" } } }),
          { status: 200 },
        ),
      ),
    );
    expect(await confirmPayment(4242)).toEqual({ status: "APPROVED", applied: true });

    const paid = await prisma.printRequest.findUniqueOrThrow({ where: { id: child.id } });
    expect(paid).toMatchObject({ status: "PAID", paidPaymentId: payment.id });
    const spent = await prisma.orgPrintCredit.findMany({ where: { requestId: child.id, kind: "SPENT" } });
    expect(spent).toMatchObject([{ amount: -10000, orgId: fx.org.id }]);
    expect(await getOrgPrintCreditBalance(fx.org.id)).toBe(0);
  });
});
