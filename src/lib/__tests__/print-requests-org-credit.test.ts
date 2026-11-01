import { beforeEach, describe, expect, it } from "vitest";
import type { PrintRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  applyOrgCredit,
  getAvailableOrgPrintCredit,
  getOrgPrintCreditBalance,
  listOrgPrintCreditMovements,
  spendOrgCreditForPaidRequest,
} from "@/lib/print-requests/org-credit";
import { markPaidManually } from "@/lib/print-requests/quote";
import { lockRequestWithEvent } from "@/lib/print-requests/service";
import { seedPrintFixture, makeRequest, type PrintFixture } from "./helpers/print-requests";

let fx: PrintFixture;
beforeEach(async () => {
  fx = await seedPrintFixture();
  await prisma.orgPrintCredit.create({
    data: { orgId: fx.org.id, kind: "EARNED", amount: 45000, quantity: 90, unitPrice: 500 },
  });
});

const fail = async (p: Promise<unknown>) => p.then(() => null, (e) => e as { code: string; httpStatus?: number; status?: number; details?: unknown });
const reload = (id: string) => prisma.printRequest.findUniqueOrThrow({ where: { id } });
const thread = (id: string, eventType?: string) =>
  prisma.printRequestMessage.findMany({ where: { requestId: id, ...(eventType ? { eventType } : {}) }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
const activeLines = (id: string) =>
  prisma.printQuoteLine.findMany({ where: { requestId: id, removedAt: null }, orderBy: { position: "asc" } });

// Demande de `total` FCFA : une seule ligne de service.
async function requestOf(total = 60000, status: PrintRequestStatus = "SUBMITTED", extra = {}) {
  const r = await makeRequest(fx, { status, total, ...extra });
  await prisma.printQuoteLine.create({
    data: {
      requestId: r.id, kind: "SERVICE", label: "Impression", quantity: 1, unitPrice: total,
      lineTotal: total, position: 0, addedBy: "STAFF",
    },
  });
  return r;
}
const apply = (requestId: string, amount: number) =>
  applyOrgCredit({ requestId, amount, userId: fx.staffAdmin.id });

describe("solde et disponible", () => {
  it("solde 45 000, disponible 45 000", async () => {
    expect(await getOrgPrintCreditBalance(fx.org.id)).toBe(45000);
    expect(await getAvailableOrgPrintCredit(fx.org.id)).toBe(45000);
  });

  it("organisation sans mouvement : solde 0", async () => {
    const other = await prisma.organization.create({ data: { name: "Vide", slug: `vide-${Date.now()}` } });
    expect(await getOrgPrintCreditBalance(other.id)).toBe(0);
    expect(await getAvailableOrgPrintCredit(other.id)).toBe(0);
  });

  it("liste des mouvements : plus récent d'abord, avec la demande (null si supprimée)", async () => {
    const r = await requestOf(60000, "ACCEPTED");
    await prisma.orgPrintCredit.create({
      data: { orgId: fx.org.id, kind: "SPENT", amount: -1000, requestId: r.id },
    });
    const rows = await listOrgPrintCreditMovements(fx.org.id);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      kind: "SPENT", amount: -1000, quantity: null,
      request: { id: r.id, reference: r.reference, eventId: fx.event.id },
    });
    expect(rows[1]).toMatchObject({ kind: "EARNED", amount: 45000, quantity: 90, request: null });
  });
});

describe("applyOrgCredit", () => {
  it("appliquer 45 000 : ligne -45 000, total 15 000, disponible 0, solde toujours 45 000", async () => {
    const r = await requestOf();
    const { line, revised } = await apply(r.id, 45000);
    expect(revised).toBe(false);
    expect(line).toMatchObject({
      kind: "DISCOUNT", label: "Crédit d'impression", quantity: 1, unitPrice: -45000, lineTotal: -45000,
      addedBy: "STAFF", usesOrgCredit: true, position: 1,
    });
    expect((await reload(r.id)).total).toBe(15000);
    expect(await getAvailableOrgPrintCredit(fx.org.id)).toBe(0);
    expect(await getOrgPrintCreditBalance(fx.org.id)).toBe(45000);
    const entries = await thread(r.id, "ORG_CREDIT_APPLIED");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ side: "STAFF", authorId: fx.staffAdmin.id, details: { amount: 45000 } });
    expect(entries[0].body).toContain("Crédit d'impression appliqué");
  });

  it("le disponible exclut la demande indiquée", async () => {
    const r = await requestOf();
    await apply(r.id, 45000);
    expect(await getAvailableOrgPrintCredit(fx.org.id, r.id)).toBe(45000);
  });

  it("une seconde demande ne peut pas réutiliser ce crédit : CREDIT_INSUFFICIENT", async () => {
    const a = await requestOf();
    const b = await requestOf();
    await apply(a.id, 45000);
    const err = await fail(apply(b.id, 1));
    expect(err).toMatchObject({ code: "CREDIT_INSUFFICIENT", httpStatus: 409, details: { available: 0 } });
    expect(await activeLines(b.id)).toHaveLength(1);
  });

  it("la première demande annulée avant paiement : disponible revient à 45 000", async () => {
    const a = await requestOf();
    await apply(a.id, 45000);
    await prisma.printRequest.update({ where: { id: a.id }, data: { status: "CANCELLED" } });
    expect(await getAvailableOrgPrintCredit(fx.org.id)).toBe(45000);
    const b = await requestOf();
    expect((await apply(b.id, 45000)).line.lineTotal).toBe(-45000);
  });

  it("une demande ACCEPTED ou QUOTED réserve aussi son crédit", async () => {
    const q = await requestOf(60000, "QUOTED", { quoteVersion: 1 });
    await apply(q.id, 10000);
    const a = await requestOf(60000, "ACCEPTED");
    await prisma.printQuoteLine.create({
      data: {
        requestId: a.id, kind: "DISCOUNT", label: "Crédit", quantity: 1, unitPrice: -5000,
        lineTotal: -5000, position: 1, addedBy: "STAFF", usesOrgCredit: true,
      },
    });
    expect(await getAvailableOrgPrintCredit(fx.org.id)).toBe(30000);
  });

  it("crédit de 100 000 appliqué à 70 000 sur une demande de 60 000 : CREDIT_EXCEEDS_TOTAL", async () => {
    await prisma.orgPrintCredit.create({ data: { orgId: fx.org.id, kind: "EARNED", amount: 100000 } });
    const r = await requestOf();
    expect(await fail(apply(r.id, 70000))).toMatchObject({ code: "CREDIT_EXCEEDS_TOTAL", httpStatus: 409 });
    expect(await fail(apply(r.id, 60001))).toMatchObject({ code: "CREDIT_EXCEEDS_TOTAL" });
    expect((await apply(r.id, 60000)).line.lineTotal).toBe(-60000);
    expect((await reload(r.id)).total).toBe(0);
  });

  it("demande sans aucune ligne : CREDIT_EXCEEDS_TOTAL", async () => {
    const r = await makeRequest(fx, { status: "SUBMITTED", total: 0 });
    expect(await fail(apply(r.id, 1))).toMatchObject({ code: "CREDIT_EXCEEDS_TOTAL" });
  });

  it("réappliquer 20 000 remplace la ligne précédente (une seule ligne active)", async () => {
    const r = await requestOf();
    const first = await apply(r.id, 45000);
    const second = await apply(r.id, 20000);
    const credit = (await activeLines(r.id)).filter((l) => l.usesOrgCredit);
    expect(credit).toHaveLength(1);
    expect(credit[0]).toMatchObject({ id: second.line.id, lineTotal: -20000, position: 2 });
    const old = await prisma.printQuoteLine.findUniqueOrThrow({ where: { id: first.line.id } });
    expect(old.removedAt).not.toBeNull();
    expect((await reload(r.id)).total).toBe(40000);
    expect(await getAvailableOrgPrintCredit(fx.org.id)).toBe(25000);
  });

  it("le crédit réappliqué peut dépasser l'ancien montant tant qu'il reste disponible", async () => {
    const r = await requestOf();
    await apply(r.id, 10000);
    expect((await apply(r.id, 45000)).line.lineTotal).toBe(-45000);
  });

  it("demande QUOTED : repasse SUBMITTED avec entrée QUOTE_REVISION", async () => {
    const r = await requestOf(60000, "QUOTED", { quoteVersion: 1 });
    const { revised } = await apply(r.id, 1000);
    expect(revised).toBe(true);
    expect((await reload(r.id)).status).toBe("SUBMITTED");
    expect(await thread(r.id, "QUOTE_REVISION")).toHaveLength(1);
  });

  it("ACCEPTED, PAID, annulée, brouillon : REQUEST_LOCKED, rien d'écrit", async () => {
    for (const status of ["ACCEPTED", "PAID", "CANCELLED", "DRAFT"] as const) {
      const r = await requestOf(60000, status);
      expect(await fail(apply(r.id, 1000)), status).toMatchObject({ code: "REQUEST_LOCKED", httpStatus: 409 });
      expect(await activeLines(r.id)).toHaveLength(1);
      expect((await reload(r.id)).total).toBe(60000);
    }
  });

  it("montant invalide : VALIDATION ; demande inconnue : NOT_FOUND", async () => {
    const r = await requestOf();
    for (const amount of [0, -5, 1.5, 3_000_000_000, Number.NaN]) {
      expect(await fail(apply(r.id, amount)), String(amount)).toMatchObject({ code: "VALIDATION", status: 400 });
    }
    expect(await fail(apply("inconnue", 1000))).toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("deux applications concurrentes sur deux demandes : le crédit n'est jamais dépensé deux fois", async () => {
    const a = await requestOf();
    const b = await requestOf();
    const res = await Promise.allSettled([apply(a.id, 45000), apply(b.id, 45000)]);
    expect(res.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await getAvailableOrgPrintCredit(fx.org.id)).toBe(0);
  });
});

describe("spendOrgCreditForPaidRequest", () => {
  const spend = (requestId: string) => prisma.$transaction((tx) => spendOrgCreditForPaidRequest(tx, requestId));
  const movements = (requestId: string) => prisma.orgPrintCredit.findMany({ where: { requestId } });

  it("ligne de crédit : mouvement SPENT -45 000, solde 0, entrée du fil", async () => {
    const r = await requestOf();
    await apply(r.id, 45000);
    expect(await spend(r.id)).toBe(45000);
    expect(await movements(r.id)).toMatchObject([{ kind: "SPENT", amount: -45000, orgId: fx.org.id }]);
    expect(await getOrgPrintCreditBalance(fx.org.id)).toBe(0);
    const entries = await thread(r.id, "ORG_CREDIT_SPENT");
    expect(entries).toHaveLength(1);
    expect(entries[0].details).toEqual({ amount: 45000 });
    expect(entries[0].body).toContain("Crédit d'impression décompté");
  });

  it("appelée deux fois : un seul mouvement, une seule entrée, 0 au second appel", async () => {
    const r = await requestOf();
    await apply(r.id, 45000);
    expect(await spend(r.id)).toBe(45000);
    expect(await spend(r.id)).toBe(0);
    expect(await movements(r.id)).toHaveLength(1);
    expect(await thread(r.id, "ORG_CREDIT_SPENT")).toHaveLength(1);
  });

  it("appels concurrents sous le verrou de la demande (comme les appelants) : un seul mouvement SPENT", async () => {
    const r = await requestOf();
    await apply(r.id, 45000);
    const locked = () =>
      prisma.$transaction(async (tx) => {
        await lockRequestWithEvent(tx, r.id);
        return spendOrgCreditForPaidRequest(tx, r.id);
      });
    const amounts = await Promise.all([locked(), locked()]);
    expect(amounts.sort()).toEqual([0, 45000]);
    expect(await movements(r.id)).toHaveLength(1);
  });

  it("sans ligne de crédit, ou ligne retirée : 0 et aucun mouvement", async () => {
    const plain = await requestOf();
    expect(await spend(plain.id)).toBe(0);
    const removed = await requestOf();
    const { line } = await apply(removed.id, 1000);
    await prisma.printQuoteLine.update({ where: { id: line.id }, data: { removedAt: new Date() } });
    expect(await spend(removed.id)).toBe(0);
    expect(await movements(plain.id)).toHaveLength(0);
    expect(await movements(removed.id)).toHaveLength(0);
  });

  it("paiement hors ligne (marquer payé) : même dépense", async () => {
    const r = await requestOf(60000);
    await apply(r.id, 45000);
    await prisma.printRequest.update({
      where: { id: r.id }, data: { status: "ACCEPTED", quoteVersion: 1, acceptedVersion: 1, acceptedTotal: 15000 },
    });
    const paid = await markPaidManually({ requestId: r.id, userId: fx.staffAdmin.id, reason: "Virement reçu" });
    expect(paid.status).toBe("PAID");
    expect(await movements(r.id)).toMatchObject([{ kind: "SPENT", amount: -45000 }]);
    expect(await getOrgPrintCreditBalance(fx.org.id)).toBe(0);
    expect(await thread(r.id, "ORG_CREDIT_SPENT")).toHaveLength(1);
  });

  it("marquer payé refusé : aucun mouvement", async () => {
    const r = await requestOf(60000, "QUOTED");
    await prisma.printQuoteLine.create({
      data: {
        requestId: r.id, kind: "DISCOUNT", label: "Crédit", quantity: 1, unitPrice: -1000,
        lineTotal: -1000, position: 1, addedBy: "STAFF", usesOrgCredit: true,
      },
    });
    await fail(markPaidManually({ requestId: r.id, userId: fx.staffAdmin.id, reason: "Virement reçu" }));
    expect(await movements(r.id)).toHaveLength(0);
  });
});
