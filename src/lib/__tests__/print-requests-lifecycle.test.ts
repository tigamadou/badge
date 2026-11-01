import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { PrintRequestError } from "@/lib/print-requests/errors";
import { acceptQuote, cancelRequest, submitRequest } from "@/lib/print-requests/lifecycle";
import { paymentProbe } from "@/lib/print-requests/service";
import * as triggers from "@/lib/notifications/triggers";
import { seedPrintFixture, makeRequest, type PrintFixture } from "./helpers/print-requests";

vi.mock("@/lib/notifications/triggers", () => ({
  notifyPrintRequestSubmitted: vi.fn(async () => {}),
  notifyPrintRequestStatusChanged: vi.fn(async () => {}),
}));

let fx: PrintFixture;
beforeEach(async () => {
  fx = await seedPrintFixture();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const reject = async (p: Promise<unknown>) => p.then(() => null, (e) => e as PrintRequestError);
const thread = (id: string) =>
  prisma.printRequestMessage.findMany({ where: { requestId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
const base = (requestId: string) => ({ requestId, eventId: fx.event.id, userId: fx.owner.id });

const badgeLine = (requestId: string, productId = fx.badgeProduct.id) =>
  prisma.printQuoteLine.create({
    data: {
      requestId, kind: "PRODUCT", productId, label: "Support badge PVC", quantity: 3, unitPrice: 1500,
      lineTotal: 4500, position: 0, addedBy: "ORGANIZER",
    },
  });

// Brouillon prêt à l'envoi : produit badge, trois inscriptions, remise sur place.
async function readyDraft(over: Parameters<typeof makeRequest>[1] = {}, regs = fx.approved) {
  const r = await makeRequest(fx, { status: "DRAFT", delivery: "PICKUP", total: 4500, ...over });
  await badgeLine(r.id);
  for (const [position, reg] of [...regs].reverse().entries()) {
    await prisma.printRequestItem.create({ data: { requestId: r.id, registrationId: reg.id, position } });
  }
  return r;
}

describe("submitRequest", () => {
  it("envoi complet : SUBMITTED, submittedAt, copie du template, entrée du fil", async () => {
    const r = await readyDraft();
    const out = await submitRequest(base(r.id));
    expect(out.status).toBe("SUBMITTED");
    expect(out.submittedAt).toBeInstanceOf(Date);
    expect(out.badgeTemplateId).toBe(fx.template.id);
    expect([out.badgeWidthPx, out.badgeHeightPx, out.badgePages]).toEqual([320, 460, 2]);
    const entries = await thread(r.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ eventType: "SUBMITTED", side: "ORGANIZER", authorId: fx.owner.id });
    expect(entries[0].body).toContain("Demande envoyée : 3 badges");
    expect(triggers.notifyPrintRequestSubmitted).toHaveBeenCalledWith(r.id, fx.owner.id);
    // Positions recalculées dans l'ordre d'impression (catégorie, nom).
    const items = await prisma.printRequestItem.findMany({ where: { requestId: r.id }, orderBy: { position: "asc" } });
    expect(items.map((i) => i.registrationId)).toEqual(fx.approved.map((a) => a.id));
  });

  it("autre évènement -> NOT_FOUND ; demande déjà envoyée -> INVALID_TRANSITION", async () => {
    const r = await readyDraft();
    expect((await reject(submitRequest({ ...base(r.id), eventId: "autre" })))?.code).toBe("NOT_FOUND");
    await submitRequest(base(r.id));
    expect((await reject(submitRequest(base(r.id))))?.code).toBe("INVALID_TRANSITION");
  });

  it("envoi sans produit BADGE -> BADGE_PRODUCT_REQUIRED (aucun, ou accessoire seul)", async () => {
    const none = await makeRequest(fx, { status: "DRAFT" });
    expect((await reject(submitRequest(base(none.id))))?.code).toBe("BADGE_PRODUCT_REQUIRED");
    const acc = await makeRequest(fx, { status: "DRAFT" });
    await badgeLine(acc.id, fx.lanyard.id);
    expect((await reject(submitRequest(base(acc.id))))?.code).toBe("BADGE_PRODUCT_REQUIRED");
  });

  it("ADVANCE sans badge -> EMPTY_SELECTION ; sans mode de remise -> DELIVERY_INCOMPLETE { delivery }", async () => {
    const empty = await readyDraft({}, []);
    expect((await reject(submitRequest(base(empty.id))))?.code).toBe("EMPTY_SELECTION");
    const nodelivery = await readyDraft({ delivery: null });
    const err = await reject(submitRequest(base(nodelivery.id)));
    expect(err?.code).toBe("DELIVERY_INCOMPLETE");
    expect(err?.details).toEqual({ fields: ["delivery"] });
  });

  it("livraison sans adresse -> DELIVERY_INCOMPLETE { fields: ['deliveryAddress'] }", async () => {
    const r = await readyDraft({ delivery: "DELIVERY", deliveryContactName: "Awa", deliveryContactPhone: "90000000" });
    const err = await reject(submitRequest(base(r.id)));
    expect(err?.code).toBe("DELIVERY_INCOMPLETE");
    expect(err?.details).toEqual({ fields: ["deliveryAddress"] });
    const blank = await readyDraft({ delivery: "DELIVERY", deliveryAddress: "  " });
    expect((await reject(submitRequest(base(blank.id))))?.details).toEqual({
      fields: ["deliveryAddress", "deliveryContactName", "deliveryContactPhone"],
    });
  });

  it("livraison complète : envoi accepté", async () => {
    const r = await readyDraft({
      delivery: "DELIVERY", deliveryAddress: "Rue 1", deliveryContactName: "Awa", deliveryContactPhone: "90000000",
    });
    expect((await submitRequest(base(r.id))).status).toBe("SUBMITTED");
  });

  it("ONSITE sans horaires -> ONSITE_INCOMPLETE { fields: ['onsiteSchedule'] } ; complet -> envoyé", async () => {
    const full = {
      type: "ONSITE" as const, status: "DRAFT" as const, estimatedQuantity: 50, onsiteLocation: "Hall A",
      onsiteContactName: "Moussa", onsiteContactPhone: "91000000", total: 4500,
    };
    const r = await makeRequest(fx, full);
    await badgeLine(r.id);
    const err = await reject(submitRequest(base(r.id)));
    expect(err?.code).toBe("ONSITE_INCOMPLETE");
    expect(err?.details).toEqual({ fields: ["onsiteSchedule"] });
    const empty = await makeRequest(fx, { ...full, onsiteSchedule: [] });
    await badgeLine(empty.id);
    expect((await reject(submitRequest(base(empty.id))))?.details).toEqual({ fields: ["onsiteSchedule"] });
    const ok = await makeRequest(fx, { ...full, onsiteSchedule: [{ date: "2026-11-02", from: "09:00", to: "18:00" }] });
    await badgeLine(ok.id);
    const out = await submitRequest(base(ok.id));
    expect(out.status).toBe("SUBMITTED");
    expect((await thread(ok.id))[0].body).toContain("50 badges");
  });

  it("ONSITE : tous les champs manquants sont listés", async () => {
    const r = await makeRequest(fx, { type: "ONSITE", status: "DRAFT" });
    await badgeLine(r.id);
    expect((await reject(submitRequest(base(r.id))))?.details).toEqual({
      fields: ["estimatedQuantity", "onsiteSchedule", "onsiteLocation", "onsiteContactName", "onsiteContactPhone"],
    });
  });

  it("deux brouillons avec la même inscription : le premier envoi passe, le second -> REGISTRATIONS_TAKEN", async () => {
    const a = await readyDraft({}, [fx.approved[0], fx.approved[1]]);
    const b = await readyDraft({}, [fx.approved[1], fx.approved[2]]);
    await submitRequest(base(a.id));
    const err = await reject(submitRequest(base(b.id)));
    expect(err?.code).toBe("REGISTRATIONS_TAKEN");
    expect(err?.details).toEqual({ registrationIds: [fx.approved[1].id] });
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("DRAFT");
  });

  it("deux envois concurrents partageant une inscription : exactement un fulfilled", async () => {
    const a = await readyDraft({}, [fx.approved[0], fx.approved[1]]);
    const b = await readyDraft({}, [fx.approved[1], fx.approved[2]]);
    const res = await Promise.allSettled([submitRequest(base(a.id)), submitRequest(base(b.id))]);
    expect(res.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const rejected = res.find((x) => x.status === "rejected") as PromiseRejectedResult;
    expect((rejected.reason as PrintRequestError).code).toBe("REGISTRATIONS_TAKEN");
  });
});

describe("cancelRequest", () => {
  it("annuler un ACCEPTED avec paiement en cours -> PAYMENT_IN_PROGRESS ; sans -> CANCELLED, acceptation effacée", async () => {
    const r = await makeRequest(fx, {
      status: "ACCEPTED", acceptedVersion: 1, acceptedTotal: 4500, acceptedAt: new Date(), acceptedById: fx.owner.id,
    });
    const spy = vi.spyOn(paymentProbe, "isPaymentInProgress").mockResolvedValue(true);
    expect((await reject(cancelRequest(base(r.id))))?.code).toBe("PAYMENT_IN_PROGRESS");
    spy.mockResolvedValue(false);
    const out = await cancelRequest(base(r.id));
    expect(out.from).toBe("ACCEPTED");
    expect(out.request).toMatchObject({
      status: "CANCELLED", acceptedVersion: null, acceptedTotal: null, acceptedAt: null, acceptedById: null,
    });
    expect(out.request.cancelledAt).toBeInstanceOf(Date);
    expect((await thread(r.id)).map((e) => e.eventType)).toEqual(["CANCELLED"]);
    expect(triggers.notifyPrintRequestStatusChanged).toHaveBeenCalledWith(r.id, fx.owner.id, { organizer: false, staff: true });
  });

  it("annuler un brouillon : pas de sonde de paiement ; autre évènement -> NOT_FOUND", async () => {
    const r = await makeRequest(fx, { status: "DRAFT" });
    const spy = vi.spyOn(paymentProbe, "isPaymentInProgress");
    expect((await reject(cancelRequest({ ...base(r.id), eventId: "autre" })))?.code).toBe("NOT_FOUND");
    expect((await cancelRequest(base(r.id))).request.status).toBe("CANCELLED");
    expect(spy).not.toHaveBeenCalled();
  });

  it("annuler libère les inscriptions : un nouveau brouillon peut les envoyer", async () => {
    const a = await readyDraft();
    await submitRequest(base(a.id));
    const b = await readyDraft();
    expect((await reject(submitRequest(base(b.id))))?.code).toBe("REGISTRATIONS_TAKEN");
    await cancelRequest(base(a.id));
    expect(await prisma.printRequestItem.count({ where: { requestId: a.id } })).toBe(3);
    expect((await submitRequest(base(b.id))).status).toBe("SUBMITTED");
  });

  it("annuler un PAID -> INVALID_TRANSITION", async () => {
    const r = await makeRequest(fx, { status: "PAID" });
    expect((await reject(cancelRequest(base(r.id))))?.code).toBe("INVALID_TRANSITION");
  });
});

describe("acceptQuote", () => {
  const quoted = () => makeRequest(fx, { status: "QUOTED", quoteVersion: 2, total: 6000 });

  it("accepter la version 2 sur un devis v2 : ACCEPTED, acceptedTotal = total, entrée « Devis v2 accepté »", async () => {
    const r = await quoted();
    const now = new Date("2026-11-02T08:00:00Z");
    const out = await acceptQuote({ ...base(r.id), version: 2, now });
    expect(out).toMatchObject({
      status: "ACCEPTED", acceptedVersion: 2, acceptedTotal: 6000, acceptedById: fx.owner.id,
    });
    expect(out.acceptedAt).toEqual(now);
    const entries = await thread(r.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ eventType: "QUOTE_ACCEPTED", side: "ORGANIZER" });
    expect(entries[0].body).toContain("Devis v2 accepté");
    expect(triggers.notifyPrintRequestStatusChanged).toHaveBeenCalledTimes(1);
  });

  it("accepter sans date explicite utilise l'instant courant", async () => {
    const r = await quoted();
    expect((await acceptQuote({ ...base(r.id), version: 2 })).acceptedAt).toBeInstanceOf(Date);
  });

  it("accepter la version 1 sur un devis v2 -> QUOTE_VERSION_MISMATCH { current: 2 }, rien d'écrit", async () => {
    const r = await quoted();
    const err = await reject(acceptQuote({ ...base(r.id), version: 1 }));
    expect(err?.code).toBe("QUOTE_VERSION_MISMATCH");
    expect(err?.details).toEqual({ current: 2 });
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("QUOTED");
    expect(await thread(r.id)).toHaveLength(0);
  });

  it("MANAGER -> OWNER_REQUIRED ; staff -> STAFF_FORBIDDEN ; SUBMITTED -> INVALID_TRANSITION ; autre évènement -> NOT_FOUND", async () => {
    const r = await quoted();
    expect((await reject(acceptQuote({ ...base(r.id), userId: fx.manager.id, version: 2 })))?.code).toBe("OWNER_REQUIRED");
    expect((await reject(acceptQuote({ ...base(r.id), userId: fx.staffAdmin.id, version: 2 })))?.code).toBe("STAFF_FORBIDDEN");
    expect((await reject(acceptQuote({ ...base(r.id), eventId: "autre", version: 2 })))?.code).toBe("NOT_FOUND");
    const s = await makeRequest(fx, { status: "SUBMITTED", quoteVersion: 2 });
    expect((await reject(acceptQuote({ ...base(s.id), version: 2 })))?.code).toBe("INVALID_TRANSITION");
  });
});
