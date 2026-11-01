import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { PrintRequestError } from "@/lib/print-requests/errors";
import { OnsiteError } from "@/lib/print-requests/onsite";
import {
  loadOnsiteRequest,
  lookupOnsiteRegistration,
  recordOnsitePrint,
  searchOnsiteRegistrations,
} from "@/lib/print-requests/onsite-station";
import { sendBadgePrintedNotification } from "@/lib/mail";
import { notifyBadgePrinted } from "@/lib/notifications/triggers";
import { seedPrintFixture, makeRequest, type PrintFixture } from "./helpers/print-requests";

vi.mock("@/lib/mail", () => ({ sendBadgePrintedNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notifications/triggers", () => ({ notifyBadgePrinted: vi.fn().mockResolvedValue(undefined) }));

let fx: PrintFixture;
const reject = async (p: Promise<unknown>) => p.then(() => null, (e) => e as Error);
const rejectCode = async (p: Promise<unknown>) => {
  const e = (await reject(p)) as OnsiteError;
  return { code: e.code, status: e.httpStatus, details: e.details };
};

// Demande IN_PRODUCTION, ligne BADGE de 10 à 1 500, marge 10 % : plafond 11.
async function onsiteRequest(over: Parameters<typeof makeRequest>[1] = {}, quantity: number | null = 10) {
  const r = await makeRequest(fx, {
    type: "ONSITE", status: "IN_PRODUCTION", estimatedQuantity: 10, marginPercent: 10, ...over,
  });
  if (quantity !== null) {
    await prisma.printQuoteLine.create({
      data: {
        requestId: r.id, kind: "PRODUCT", productId: fx.badgeProduct.id, label: "Badge",
        quantity, unitPrice: 1500, lineTotal: quantity * 1500, position: 0, addedBy: "ORGANIZER",
      },
    });
  }
  return r;
}

const prior = (requestId: string, n: number) =>
  prisma.printRequestPrint.createMany({
    data: Array.from({ length: n }, () => ({ requestId, registrationId: null, reprint: false })),
  });

const input = (requestId: string, registrationId: string, confirmReprint = false) => ({
  requestId, registrationId, userId: fx.owner.id, confirmReprint,
});

beforeEach(async () => {
  vi.clearAllMocks();
  fx = await seedPrintFixture();
});

describe("loadOnsiteRequest", () => {
  it("demande inconnue : NOT_FOUND 404", async () => {
    expect(await rejectCode(loadOnsiteRequest("inconnue"))).toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("NOT_ONSITE pour une demande ADVANCE et pour une demande complémentaire", async () => {
    const advance = await makeRequest(fx, { type: "ADVANCE" });
    expect(await rejectCode(loadOnsiteRequest(advance.id))).toMatchObject({ code: "NOT_ONSITE", status: 409 });
    const parent = await onsiteRequest();
    const child = await onsiteRequest({ parentRequestId: parent.id });
    expect(await rejectCode(loadOnsiteRequest(child.id))).toMatchObject({ code: "NOT_ONSITE", status: 409 });
  });

  it("compteur : ligne BADGE, marge, premières impressions seulement", async () => {
    const r = await onsiteRequest();
    await prior(r.id, 3);
    await prisma.printRequestPrint.create({ data: { requestId: r.id, reprint: true } });
    const loaded = await loadOnsiteRequest(r.id);
    expect(loaded.orgId).toBe(fx.org.id);
    expect(loaded.eventId).toBe(fx.event.id);
    expect(loaded.request.id).toBe(r.id);
    expect(loaded.counter).toMatchObject({ ordered: 10, marginPercent: 10, cap: 11, printed: 3 });
  });

  it("sans ligne BADGE : ordered vaut estimatedQuantity ; sans rien, 0 ; marge nulle lue comme 0", async () => {
    const r = await onsiteRequest({ estimatedQuantity: 25, marginPercent: null }, null);
    expect((await loadOnsiteRequest(r.id)).counter).toMatchObject({ ordered: 25, marginPercent: 0, cap: 25 });
    const empty = await onsiteRequest({ estimatedQuantity: null }, null);
    expect((await loadOnsiteRequest(empty.id)).counter.ordered).toBe(0);
  });
});

describe("lookupOnsiteRegistration", () => {
  it("par URL de QR : fiche avec nom, catégorie, statut APPROVED", async () => {
    const r = await onsiteRequest();
    const reg = fx.approved[0];
    const card = await lookupOnsiteRegistration(r.id, `https://x.org/verify/${reg.id}`);
    expect(card).toMatchObject({
      id: reg.id, snapshotFirstName: "Prenom", snapshotLastName: "Alpha", status: "APPROVED",
      snapshotPhoto: "", category: { name: "Participant", color: "#000000" },
      badgePrinted: false, badgePrintedAt: null,
    });
    expect(card.snapshotEmail).toContain("@x.test");
  });

  it("ID brut accepté ; inconnu : REGISTRATION_NOT_FOUND 404", async () => {
    const r = await onsiteRequest();
    expect((await lookupOnsiteRegistration(r.id, ` ${fx.approved[1].id} `)).id).toBe(fx.approved[1].id);
    expect(await rejectCode(lookupOnsiteRegistration(r.id, "nope"))).toMatchObject({
      code: "REGISTRATION_NOT_FOUND", status: 404,
    });
  });

  it("inscription d'un autre évènement : FOREIGN_EVENT 404", async () => {
    const r = await onsiteRequest();
    const other = await seedPrintFixture();
    expect(await rejectCode(lookupOnsiteRegistration(r.id, other.approved[0].id))).toMatchObject({
      code: "FOREIGN_EVENT", status: 404,
    });
  });

  it("inscription PENDING : NOT_APPROVED 409 avec status 'PENDING'", async () => {
    const r = await onsiteRequest();
    expect(await rejectCode(lookupOnsiteRegistration(r.id, fx.pending.id))).toEqual({
      code: "NOT_APPROVED", status: 409, details: { status: "PENDING" },
    });
  });
});

describe("searchOnsiteRegistrations", () => {
  it("'dup' trouve « Dupont » et « dupuis@x.org », 'C01-2026' trouve par ID, 'd' -> []", async () => {
    const r = await onsiteRequest();
    const u1 = await prisma.user.create({ data: { email: "u1@x.test", password: "x", name: "u1" } });
    const u2 = await prisma.user.create({ data: { email: "u2@x.test", password: "x", name: "u2" } });
    const u3 = await prisma.user.create({ data: { email: "u3@x.test", password: "x", name: "u3" } });
    const mkReg = (id: string, userId: string, last: string, email: string) =>
      prisma.registration.create({
        data: {
          id, userId, eventId: fx.event.id, categoryId: fx.categories[0].id,
          status: "REJECTED", snapshotFirstName: "Zoe", snapshotLastName: last, snapshotEmail: email,
          snapshotStructure: "S", snapshotPhoto: "", snapshotIdDocumentType: "CNI",
          snapshotIdDocumentNumber: "1", snapshotIdDocument: "",
        },
      });
    await mkReg("X1", u1.id, "Dupont", "a@x.org");
    await mkReg("X2", u2.id, "Martin", "dupuis@x.org");
    await mkReg("C01-2026", u3.id, "Zed", "z@x.org");
    const names = async (q: string) => (await searchOnsiteRegistrations(r.id, q)).map((c) => c.id);
    expect(await names("dup")).toEqual(["X1", "X2"]);
    expect(await names("C01-2026")).toEqual(["C01-2026"]);
    expect(await names("d")).toEqual([]);
    expect(await names("  d ")).toEqual([]);
    // Inscriptions d'un autre évènement exclues ; tous statuts inclus (REJECTED ci-dessus).
    const other = await seedPrintFixture();
    expect(await names(other.approved[0].id.slice(0, 6))).toEqual([]);
  });

  it("20 au plus, triées par nom puis prénom", async () => {
    const r = await onsiteRequest();
    const users = await Promise.all(
      Array.from({ length: 22 }, (_, i) =>
        prisma.user.create({ data: { email: `s${i}@x.test`, password: "x", name: `s${i}` } }),
      ),
    );
    await prisma.registration.createMany({
      data: users.map((u, i) => ({
        id: `SRT-${String(i).padStart(2, "0")}`, userId: u.id, eventId: fx.event.id,
        categoryId: fx.categories[0].id, status: "APPROVED" as const,
        snapshotFirstName: i % 2 ? "Bea" : "Ana", snapshotLastName: `Sortable${i < 11 ? "A" : "B"}`,
        snapshotEmail: `s${i}@x.test`, snapshotStructure: "S", snapshotPhoto: "",
        snapshotIdDocumentType: "CNI", snapshotIdDocumentNumber: "1", snapshotIdDocument: "",
      })),
    });
    const cards = await searchOnsiteRegistrations(r.id, "Sortable");
    expect(cards).toHaveLength(20);
    const keys = cards.map((c) => `${c.snapshotLastName}|${c.snapshotFirstName}`);
    expect(keys).toEqual([...keys].sort());
  });
});

describe("recordOnsitePrint", () => {
  it("impression : badgePrinted vrai, compteur printed 1, notification et email mis en file", async () => {
    const r = await onsiteRequest();
    const reg = fx.approved[0];
    const { print, counter } = await recordOnsitePrint(input(r.id, reg.id));
    expect(print).toMatchObject({ requestId: r.id, registrationId: reg.id, printedById: fx.owner.id, reprint: false });
    expect(counter).toMatchObject({ printed: 1, cap: 11 });
    const after = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } });
    expect(after.badgePrinted).toBe(true);
    expect(after.badgePrintedAt).not.toBeNull();
    expect(notifyBadgePrinted).toHaveBeenCalledWith([reg.id], fx.owner.id);
    expect(sendBadgePrintedNotification).toHaveBeenCalledWith(reg.id);
  });

  it("l'erreur d'email est journalisée sans bloquer", async () => {
    vi.mocked(sendBadgePrintedNotification).mockRejectedValueOnce(new Error("smtp"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await onsiteRequest();
    await expect(recordOnsitePrint(input(r.id, fx.approved[0].id))).resolves.toBeTruthy();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("10 déjà comptées : la 11e passe, la 12e est refusée CAP_REACHED", async () => {
    const r = await onsiteRequest();
    await prior(r.id, 10);
    const { counter } = await recordOnsitePrint(input(r.id, fx.approved[0].id));
    expect(counter).toMatchObject({ printed: 11, level: "CAP_REACHED" });
    expect(await rejectCode(recordOnsitePrint(input(r.id, fx.approved[1].id)))).toMatchObject({
      code: "CAP_REACHED", status: 409,
    });
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: fx.approved[1].id } })).badgePrinted).toBe(false);
  });

  it("au plafond, une réimpression confirmée passe et ne compte pas (printed reste 11)", async () => {
    const r = await onsiteRequest();
    await prior(r.id, 10);
    await recordOnsitePrint(input(r.id, fx.approved[0].id));
    vi.clearAllMocks();
    const { print, counter } = await recordOnsitePrint(input(r.id, fx.approved[0].id, true));
    expect(print.reprint).toBe(true);
    expect(counter.printed).toBe(11);
    expect(notifyBadgePrinted).not.toHaveBeenCalled();
    expect(sendBadgePrintedNotification).not.toHaveBeenCalled();
  });

  it("badge imprimé par l'organisateur : ALREADY_PRINTED sans confirmation ; reprint avec", async () => {
    const r = await onsiteRequest();
    const at = new Date("2026-11-01T10:00:00Z");
    await prisma.registration.update({ where: { id: fx.approved[0].id }, data: { badgePrinted: true, badgePrintedAt: at } });
    const err = await rejectCode(recordOnsitePrint(input(r.id, fx.approved[0].id)));
    expect(err).toMatchObject({ code: "ALREADY_PRINTED", status: 409 });
    expect(err.details).toEqual({ printedAt: at });
    const { print, counter } = await recordOnsitePrint(input(r.id, fx.approved[0].id, true));
    expect(print.reprint).toBe(true);
    expect(counter.printed).toBe(0);
  });

  it("demande QUOTED : REQUEST_NOT_PRINTABLE ; PAID et READY passent", async () => {
    const q = await onsiteRequest({ status: "QUOTED" });
    expect(await rejectCode(recordOnsitePrint(input(q.id, fx.approved[0].id)))).toMatchObject({
      code: "REQUEST_NOT_PRINTABLE", status: 409,
    });
    for (const [i, status] of (["PAID", "READY"] as const).entries()) {
      const r = await onsiteRequest({ status });
      await expect(recordOnsitePrint(input(r.id, fx.approved[i + 1].id))).resolves.toBeTruthy();
    }
  });

  it("refus : demande inconnue, ADVANCE, inscription inconnue, autre évènement, PENDING", async () => {
    expect(await reject(recordOnsitePrint(input("inconnue", fx.approved[0].id)))).toBeInstanceOf(PrintRequestError);
    const advance = await makeRequest(fx, { type: "ADVANCE", status: "IN_PRODUCTION" });
    expect(await rejectCode(recordOnsitePrint(input(advance.id, fx.approved[0].id)))).toMatchObject({ code: "NOT_ONSITE" });
    const r = await onsiteRequest();
    expect(await rejectCode(recordOnsitePrint(input(r.id, "nope")))).toMatchObject({ code: "REGISTRATION_NOT_FOUND" });
    const other = await seedPrintFixture();
    expect(await rejectCode(recordOnsitePrint(input(r.id, other.approved[0].id)))).toMatchObject({ code: "FOREIGN_EVENT" });
    expect(await rejectCode(recordOnsitePrint(input(r.id, fx.pending.id)))).toMatchObject({
      code: "NOT_APPROVED", details: { status: "PENDING" },
    });
    expect(await prisma.printRequestPrint.count({ where: { requestId: r.id } })).toBe(0);
  });

  it("deux impressions concurrentes à 10/11 : une seule passe", async () => {
    const r = await onsiteRequest();
    await prior(r.id, 10);
    const res = await Promise.allSettled([
      recordOnsitePrint(input(r.id, fx.approved[0].id)),
      recordOnsitePrint(input(r.id, fx.approved[1].id)),
    ]);
    expect(res.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const rejected = res.find((x) => x.status === "rejected") as PromiseRejectedResult;
    expect((rejected.reason as OnsiteError).code).toBe("CAP_REACHED");
    expect(await prisma.printRequestPrint.count({ where: { requestId: r.id, reprint: false } })).toBe(11);
  });
});
