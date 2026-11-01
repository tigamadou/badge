import { describe, it, expect, beforeEach } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PrintRequestError } from "@/lib/print-requests/errors";
import {
  followBadgeCount,
  listCandidates,
  lockEventRow,
  reservedRegistrations,
  setBadges,
  updateDetails,
} from "@/lib/print-requests/content";
import {
  badgeSelectionSchema,
  detailsPatchSchema,
  onsiteSlotSchema,
} from "@/lib/print-requests/inputs";
import { seedPrintFixture, makeRequest, type PrintFixture } from "./helpers/print-requests";

let fx: PrintFixture;
beforeEach(async () => {
  fx = await seedPrintFixture();
});

const reject = async (p: Promise<unknown>) =>
  p.then(() => null, (e) => e as PrintRequestError);
const run = <T,>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => prisma.$transaction(fn);
const thread = (id: string) =>
  prisma.printRequestMessage.findMany({ where: { requestId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
const items = (id: string) =>
  prisma.printRequestItem.findMany({ where: { requestId: id }, orderBy: { position: "asc" } });
const reserve = (requestId: string, registrationId: string, position = 0) =>
  prisma.printRequestItem.create({ data: { requestId, registrationId, position } });
const base = (over: Partial<Parameters<typeof setBadges>[0]> = {}) => ({
  eventId: fx.event.id, userId: fx.owner.id, selection: { mode: "ALL_AVAILABLE" } as const, requestId: "", ...over,
});
const line = (
  requestId: string,
  over: Partial<Prisma.PrintQuoteLineUncheckedCreateInput> & { label: string; quantity: number; unitPrice: number },
) =>
  prisma.printQuoteLine.create({
    data: {
      requestId, kind: "PRODUCT", lineTotal: over.quantity * over.unitPrice, position: 0, addedBy: "ORGANIZER", ...over,
    },
  });

describe("schémas", () => {
  it("créneau : from < to exigé", () => {
    expect(onsiteSlotSchema.safeParse({ date: "2026-11-02", from: "09:00", to: "18:00" }).success).toBe(true);
    expect(onsiteSlotSchema.safeParse({ date: "2026-11-02", from: "18:00", to: "09:00" }).success).toBe(false);
    expect(onsiteSlotSchema.safeParse({ date: "2/11", from: "09:00", to: "18:00" }).success).toBe(false);
  });
  it("patch : bornes et valeurs nulles", () => {
    expect(detailsPatchSchema.safeParse({ wantedBy: null, notes: null }).success).toBe(true);
    expect(detailsPatchSchema.safeParse({ wantedBy: "2026-12-01" }).success).toBe(true);
    expect(detailsPatchSchema.safeParse({ wantedBy: "pas une date" }).success).toBe(false);
    expect(detailsPatchSchema.safeParse({ estimatedQuantity: 0 }).success).toBe(false);
    expect(detailsPatchSchema.safeParse({ estimatedQuantity: 100_001 }).success).toBe(false);
    expect(detailsPatchSchema.safeParse({ onsiteSchedule: [] }).success).toBe(false);
    expect(detailsPatchSchema.safeParse({ delivery: "DRONE" }).success).toBe(false);
  });
  it("sélection : trois modes, listes non vides", () => {
    expect(badgeSelectionSchema.safeParse({ mode: "ALL_AVAILABLE" }).success).toBe(true);
    expect(badgeSelectionSchema.safeParse({ mode: "CATEGORIES", categoryIds: [] }).success).toBe(false);
    expect(badgeSelectionSchema.safeParse({ mode: "IDS", registrationIds: ["a"] }).success).toBe(true);
  });
});

describe("lockEventRow / reservedRegistrations / listCandidates", () => {
  it("lockEventRow s'exécute dans une transaction", async () => {
    await expect(run((tx) => lockEventRow(tx, fx.event.id))).resolves.toBeUndefined();
  });

  it("3 candidats (PENDING absente), ordre catégorie-nom, réservation par une demande SUBMITTED seulement", async () => {
    const mine = await makeRequest(fx, { status: "DRAFT" });
    const other = await makeRequest(fx, { status: "SUBMITTED" });
    await reserve(other.id, fx.approved[0].id);
    await reserve(mine.id, fx.approved[1].id);
    const rows = await listCandidates(fx.event.id, mine.id);
    expect(rows.map((r) => r.lastName)).toEqual(["Alpha", "Bravo", "Charlie"]);
    expect(rows[0]).toMatchObject({
      id: fx.approved[0].id, firstName: "Prenom", categoryName: "Participant", categoryNumber: 1,
      printed: false, reservedBy: other.reference, selected: false,
    });
    expect(rows[1]).toMatchObject({ reservedBy: null, selected: true });
    expect(rows[2]).toMatchObject({ categoryName: "Exposant", categoryNumber: 2, selected: false });
  });

  it.each(["DRAFT", "CANCELLED", "REJECTED"] as const)("demande %s : ne réserve rien", async (status) => {
    const mine = await makeRequest(fx, { status: "DRAFT" });
    const other = await makeRequest(fx, { status });
    await reserve(other.id, fx.approved[0].id);
    expect((await listCandidates(fx.event.id, mine.id))[0].reservedBy).toBeNull();
    expect((await run((tx) => reservedRegistrations(tx, fx.event.id, mine.id))).size).toBe(0);
  });

  it("une inscription imprimée est signalée", async () => {
    await prisma.registration.update({ where: { id: fx.approved[2].id }, data: { badgePrinted: true } });
    const rows = await listCandidates(fx.event.id, "inconnue");
    expect(rows.map((r) => r.printed)).toEqual([false, false, true]);
  });
});

describe("setBadges", () => {
  it("ALL_AVAILABLE exclut l'imprimée et la réservée ; positions 0..n-1 dans l'ordre", async () => {
    const r = await makeRequest(fx, { status: "DRAFT" });
    const other = await makeRequest(fx, { status: "SUBMITTED" });
    await reserve(other.id, fx.approved[1].id);
    await prisma.registration.update({ where: { id: fx.approved[2].id }, data: { badgePrinted: true } });
    const res = await setBadges(base({ requestId: r.id }));
    expect(res).toEqual({ count: 1, revised: false });
    expect((await items(r.id)).map((i) => [i.registrationId, i.position])).toEqual([[fx.approved[0].id, 0]]);
  });

  it("ordre catégorie, nom, prénom et remplacement des items précédents", async () => {
    const r = await makeRequest(fx, { status: "DRAFT" });
    await reserve(r.id, fx.approved[2].id, 0);
    const res = await setBadges(base({ requestId: r.id }));
    expect(res.count).toBe(3);
    expect((await items(r.id)).map((i) => [i.registrationId, i.position])).toEqual(
      fx.approved.map((a, i) => [a.id, i]),
    );
  });

  it("CATEGORIES [c1] -> 2 items", async () => {
    const r = await makeRequest(fx, { status: "DRAFT" });
    const res = await setBadges(base({ requestId: r.id, selection: { mode: "CATEGORIES", categoryIds: [fx.categories[0].id] } }));
    expect(res.count).toBe(2);
  });

  it("IDS : inscription PENDING -> INVALID_SELECTION avec son id", async () => {
    const r = await makeRequest(fx, { status: "DRAFT" });
    const err = await reject(setBadges(base({ requestId: r.id, selection: { mode: "IDS", registrationIds: [fx.approved[0].id, fx.pending.id] } })));
    expect([err?.code, err?.status, err?.details]).toEqual(["INVALID_SELECTION", 400, { registrationIds: [fx.pending.id] }]);
  });

  it("IDS : réservée ailleurs -> 409 REGISTRATIONS_TAKEN ; imprimée permise", async () => {
    const r = await makeRequest(fx, { status: "DRAFT" });
    const other = await makeRequest(fx, { status: "PAID" });
    await reserve(other.id, fx.approved[0].id);
    const err = await reject(setBadges(base({ requestId: r.id, selection: { mode: "IDS", registrationIds: [fx.approved[0].id, fx.approved[1].id] } })));
    expect([err?.code, err?.status, err?.details]).toEqual(["REGISTRATIONS_TAKEN", 409, { registrationIds: [fx.approved[0].id] }]);
    await prisma.registration.update({ where: { id: fx.approved[1].id }, data: { badgePrinted: true } });
    const ok = await setBadges(base({ requestId: r.id, selection: { mode: "IDS", registrationIds: [fx.approved[1].id, fx.approved[1].id] } }));
    expect(ok.count).toBe(1);
  });

  it("sélection vide -> EMPTY_SELECTION", async () => {
    const r = await makeRequest(fx, { status: "DRAFT" });
    const err = await reject(setBadges(base({ requestId: r.id, selection: { mode: "CATEGORIES", categoryIds: ["inconnue"] } })));
    expect([err?.code, err?.status]).toEqual(["EMPTY_SELECTION", 400]);
  });

  it("demande ONSITE -> TYPE_MISMATCH ; demande d'un autre évènement -> NOT_FOUND", async () => {
    const o = await makeRequest(fx, { type: "ONSITE", status: "DRAFT" });
    expect((await reject(setBadges(base({ requestId: o.id }))))?.code).toBe("TYPE_MISMATCH");
    expect((await reject(setBadges(base({ requestId: o.id, eventId: "autre" }))))?.code).toBe("NOT_FOUND");
  });

  it("demande verrouillée (PAID) -> REQUEST_LOCKED, rien n'est écrit", async () => {
    const r = await makeRequest(fx, { status: "PAID" });
    expect((await reject(setBadges(base({ requestId: r.id }))))?.code).toBe("REQUEST_LOCKED");
    expect(await items(r.id)).toHaveLength(0);
  });

  it("suivi des quantités : 3 -> 2 badges, ligne fixée et cordon fixé conservés", async () => {
    const r = await makeRequest(fx, { status: "SUBMITTED" });
    for (const a of fx.approved) await reserve(r.id, a.id, fx.approved.indexOf(a));
    await line(r.id, { label: "Badge PVC", quantity: 3, unitPrice: 1500, position: 0 });
    await line(r.id, { label: "Cordon", quantity: 3, unitPrice: 500, position: 1 });
    await line(r.id, { label: "Pochette", quantity: 10, unitPrice: 100, position: 2, quantityOverridden: true });
    await line(r.id, { label: "Autre", quantity: 5, unitPrice: 10, position: 3 });
    await line(r.id, { label: "Remise", kind: "DISCOUNT", quantity: 1, unitPrice: -100, position: 4 });
    await line(r.id, { label: "Retiré", quantity: 3, unitPrice: 7, position: 5, removedAt: new Date() });
    const res = await setBadges(base({ requestId: r.id, selection: { mode: "CATEGORIES", categoryIds: [fx.categories[0].id] } }));
    expect(res.count).toBe(2);
    const lines = await prisma.printQuoteLine.findMany({ where: { requestId: r.id }, orderBy: { position: "asc" } });
    expect(lines.map((l) => [l.label, l.quantity, l.lineTotal])).toEqual([
      ["Badge PVC", 2, 3000], ["Cordon", 2, 1000], ["Pochette", 10, 1000], ["Autre", 5, 50],
      ["Remise", 1, -100], ["Retiré", 3, 21],
    ]);
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).total).toBe(3000 + 1000 + 1000 + 50 - 100);
    const [entry] = await thread(r.id);
    expect(entry.eventType).toBe("BADGES_CHANGED");
    expect(entry.details).toMatchObject({ added: 0, removed: 1, count: 2, lagging: ["Pochette"] });
  });

  it("demande QUOTED : SUBMITTED, revised, QUOTE_REVISION puis BADGES_CHANGED", async () => {
    const r = await makeRequest(fx, { status: "QUOTED" });
    const res = await setBadges(base({ requestId: r.id }));
    expect(res).toEqual({ count: 3, revised: true });
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("SUBMITTED");
    const entries = await thread(r.id);
    expect(entries.map((e) => e.eventType)).toEqual(["QUOTE_REVISION", "BADGES_CHANGED"]);
    expect(entries[1]).toMatchObject({ side: "ORGANIZER", authorId: fx.owner.id });
    expect(entries[1].details).toMatchObject({ added: 3, removed: 0, count: 3, lagging: [] });
  });

  it("demande DRAFT : aucune entrée", async () => {
    const r = await makeRequest(fx, { status: "DRAFT" });
    await setBadges(base({ requestId: r.id }));
    expect(await thread(r.id)).toHaveLength(0);
  });

  it("deux demandes simultanées ne se réservent pas la même inscription", async () => {
    const a = await makeRequest(fx, { status: "SUBMITTED" });
    const b = await makeRequest(fx, { status: "SUBMITTED" });
    const sel = { mode: "IDS" as const, registrationIds: [fx.approved[0].id] };
    const results = await Promise.all([
      reject(setBadges(base({ requestId: a.id, selection: sel }))),
      reject(setBadges(base({ requestId: b.id, selection: sel }))),
    ]);
    expect(results.filter((e) => e === null)).toHaveLength(1);
    expect(results.find((e) => e !== null)?.code).toBe("REGISTRATIONS_TAKEN");
  });
});

describe("followBadgeCount", () => {
  it("ligne à répartition QUANTITY_SPLIT : non suivie, signalée dans lagging", async () => {
    const r = await makeRequest(fx);
    await line(r.id, {
      label: "T-shirt", quantity: 3, unitPrice: 1000,
      choices: [{ optionId: "o", split: [{ valueId: "s", quantity: 2 }, { valueId: "m", quantity: 1 }] }],
    });
    await line(r.id, { label: "Sans split", quantity: 3, unitPrice: 100, position: 1, choices: [{ optionId: "o", valueIds: ["x"] }, null as never] });
    await line(r.id, { label: "Split vide", quantity: 3, unitPrice: 100, position: 2, choices: [{ optionId: "o", split: [] }] });
    await line(r.id, { label: "Choix objet", quantity: 3, unitPrice: 100, position: 3, choices: { not: "un tableau" } });
    const res = await run((tx) => followBadgeCount(tx, r.id, 3, 2));
    expect(res.lagging).toEqual(["T-shirt"]);
    const lines = await prisma.printQuoteLine.findMany({ where: { requestId: r.id }, orderBy: { position: "asc" } });
    expect(lines.map((l) => l.quantity)).toEqual([3, 2, 2, 2]);
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).total).toBe(3000 + 200 * 3);
  });

  it("ligne fixée dont la quantité égale déjà le nouveau nombre : non signalée", async () => {
    const r = await makeRequest(fx);
    await line(r.id, { label: "Fixe", quantity: 2, unitPrice: 100, quantityOverridden: true });
    expect((await run((tx) => followBadgeCount(tx, r.id, 3, 2))).lagging).toEqual([]);
  });
});

describe("updateDetails", () => {
  const upd = (requestId: string, patch: Parameters<typeof updateDetails>[0]["patch"]) =>
    updateDetails({ requestId, eventId: fx.event.id, userId: fx.owner.id, patch });

  it("livraison sur SUBMITTED : entrée « Informations modifiées »", async () => {
    const r = await makeRequest(fx, { status: "SUBMITTED" });
    const res = await upd(r.id, { delivery: "DELIVERY", deliveryAddress: "Rue 12, Cotonou" });
    expect(res.revised).toBe(false);
    expect(res.request).toMatchObject({ delivery: "DELIVERY", deliveryAddress: "Rue 12, Cotonou" });
    const [entry] = await thread(r.id);
    expect(entry.body).toBe("Informations modifiées : mode de remise, adresse de livraison");
    expect(entry).toMatchObject({ eventType: "REQUEST_UPDATED", side: "ORGANIZER", authorId: fx.owner.id });
  });

  it("tous les champs en amont, date souhaitée et remarque nulle ; libellés dédoublonnés", async () => {
    const r = await makeRequest(fx, { status: "QUOTED", notes: "x" });
    const res = await upd(r.id, {
      delivery: "PICKUP", deliveryContactName: "A", deliveryContactPhone: "1",
      wantedBy: "2026-12-01", notes: null,
    });
    expect(res.revised).toBe(true);
    expect(res.request.status).toBe("SUBMITTED");
    expect(res.request.wantedBy?.toISOString().slice(0, 10)).toBe("2026-12-01");
    expect(res.request.notes).toBeNull();
    const entries = await thread(r.id);
    expect(entries.map((e) => e.eventType)).toEqual(["QUOTE_REVISION", "REQUEST_UPDATED"]);
    expect(entries[1].body).toBe(
      "Informations modifiées : mode de remise, contact, téléphone du contact, date souhaitée, remarque",
    );
    const cleared = await upd(r.id, { wantedBy: null });
    expect(cleared.request.wantedBy).toBeNull();
  });

  it("ONSITE : horaires, lieu, contacts ; quantité estimée 150 -> 200 suit les lignes", async () => {
    const r = await makeRequest(fx, { type: "ONSITE", status: "SUBMITTED", estimatedQuantity: 150 });
    await line(r.id, { label: "Badge", quantity: 150, unitPrice: 10 });
    const res = await upd(r.id, {
      estimatedQuantity: 200,
      onsiteSchedule: [{ date: "2026-11-02", from: "08:00", to: "12:00" }],
      onsiteLocation: "Hall A", onsiteContactName: "B", onsiteContactPhone: "2",
    });
    expect(res.request.estimatedQuantity).toBe(200);
    expect(res.request.onsiteSchedule).toEqual([{ date: "2026-11-02", from: "08:00", to: "12:00" }]);
    const l = await prisma.printQuoteLine.findFirstOrThrow({ where: { requestId: r.id } });
    expect([l.quantity, l.lineTotal]).toEqual([200, 2000]);
    expect((await thread(r.id))[0].body).toBe(
      "Informations modifiées : quantité estimée, horaires sur place, lieu, contact, téléphone du contact",
    );
  });

  it("quantité estimée inchangée ou absente : lignes intactes ; demande sans quantité initiale", async () => {
    const r = await makeRequest(fx, { type: "ONSITE", status: "DRAFT", estimatedQuantity: 150 });
    await line(r.id, { label: "Badge", quantity: 150, unitPrice: 10 });
    await upd(r.id, { estimatedQuantity: 150 });
    await upd(r.id, { onsiteLocation: "Hall" });
    expect((await prisma.printQuoteLine.findFirstOrThrow({ where: { requestId: r.id } })).quantity).toBe(150);
    const n = await makeRequest(fx, { type: "ONSITE", status: "DRAFT" });
    await upd(n.id, { estimatedQuantity: 40 });
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: n.id } })).estimatedQuantity).toBe(40);
  });

  it("patch vide ou brouillon : aucune entrée", async () => {
    const r = await makeRequest(fx, { status: "SUBMITTED" });
    await upd(r.id, {});
    const d = await makeRequest(fx, { status: "DRAFT" });
    await upd(d.id, { delivery: "PICKUP" });
    expect(await thread(r.id)).toHaveLength(0);
    expect(await thread(d.id)).toHaveLength(0);
  });

  it("TYPE_MISMATCH : quantité estimée sur ADVANCE, livraison sur ONSITE", async () => {
    const a = await makeRequest(fx, { status: "SUBMITTED" });
    expect((await reject(upd(a.id, { estimatedQuantity: 200 })))?.code).toBe("TYPE_MISMATCH");
    expect((await reject(upd(a.id, { onsiteLocation: "x" })))?.code).toBe("TYPE_MISMATCH");
    const o = await makeRequest(fx, { type: "ONSITE", status: "SUBMITTED" });
    expect((await reject(upd(o.id, { delivery: "PICKUP" })))?.code).toBe("TYPE_MISMATCH");
  });

  it("créneau inversé -> VALIDATION (zod) ; demande acceptée -> QUOTE_ACCEPTED", async () => {
    const parsed = detailsPatchSchema.safeParse({ onsiteSchedule: [{ date: "2026-11-02", from: "18:00", to: "09:00" }] });
    expect(parsed.success).toBe(false);
    const r = await makeRequest(fx, { status: "ACCEPTED" });
    expect((await reject(upd(r.id, { notes: "x" })))?.code).toBe("QUOTE_ACCEPTED");
  });
});
