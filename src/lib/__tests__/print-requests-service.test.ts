import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatFcfa } from "@/lib/print-requests/labels";
import { PrintRequestError } from "@/lib/print-requests/errors";
import * as templateVars from "@/lib/badge-templates/event-template-variables";
import {
  appendThreadEvent,
  applyEdit,
  applyTransition,
  assertOwner,
  createDraft,
  isPaymentInProgress,
  loadRequest,
  markPaid,
  nextReference,
  paymentProbe,
  recomputeTotal,
  requestBadgeCount,
  retryOnReferenceCollision,
  snapshotEventTemplate,
} from "@/lib/print-requests/service";
import { seedPrintFixture, makeRequest, type PrintFixture } from "./helpers/print-requests";

vi.mock("@/lib/badge-templates/event-template-variables", async (orig) => {
  const actual = await orig<typeof import("@/lib/badge-templates/event-template-variables")>();
  return { ...actual, findEffectiveTemplateRow: vi.fn(actual.findEffectiveTemplateRow) };
});

const NOV_2026 = new Date("2026-11-01T10:00:00Z");
let fx: PrintFixture;

beforeEach(async () => {
  fx = await seedPrintFixture();
});
afterEach(() => vi.restoreAllMocks());

const reject = async (p: Promise<unknown>) => p.then(() => null, (e) => e as PrintRequestError);
const thread = (id: string) => prisma.printRequestMessage.findMany({ where: { requestId: id }, orderBy: { createdAt: "asc" } });
const run = <T,>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => prisma.$transaction(fn);

// Provoque une collision de référence : une ligne portant la même référence est insérée juste avant le create.
function collideOnCreate(times: number) {
  const original = prisma.$transaction.bind(prisma) as (fn: unknown, opts?: unknown) => Promise<unknown>;
  let left = times;
  vi.spyOn(prisma, "$transaction").mockImplementation(((fn: (tx: Prisma.TransactionClient) => Promise<unknown>, opts?: unknown) =>
    original(async (tx: Prisma.TransactionClient) => {
      const wrapped = new Proxy(tx, {
        get(target, key) {
          if (key !== "printRequest") return Reflect.get(target, key);
          return new Proxy(target.printRequest, {
            get(pt, pk) {
              if (pk !== "create") return Reflect.get(pt, pk);
              return async (args: { data: { reference: string } }) => {
                if (left > 0) {
                  left -= 1;
                  await prisma.printRequest.create({
                    data: { reference: args.data.reference, eventId: fx.event.id, orgId: fx.org.id, type: "ADVANCE" },
                  });
                }
                return pt.create(args as never);
              };
            },
          });
        },
      });
      return fn(wrapped);
    }, opts)) as never);
}

describe("createDraft / nextReference", () => {
  it("numérote IMP-2026-0001 puis IMP-2026-0002, et IMP-2027-0001 l'année suivante", async () => {
    const f = await seedPrintFixture();
    // Les références sont globales : on se place sur des années isolées de celles des autres tests.
    const y = 2300 + Math.floor(Math.random() * 600);
    const now = new Date(`${y}-03-01T10:00:00Z`);
    const a = await createDraft({ eventId: f.event.id, orgId: f.org.id, type: "ADVANCE", userId: f.owner.id, now });
    const b = await createDraft({ eventId: f.event.id, orgId: f.org.id, type: "ONSITE", userId: f.owner.id, now });
    const c = await createDraft({
      eventId: f.event.id, orgId: f.org.id, type: "ADVANCE", userId: f.owner.id,
      now: new Date(`${y + 1}-01-01T00:00:00Z`),
    });
    expect([a.reference, b.reference, c.reference]).toEqual([
      `IMP-${y}-0001`, `IMP-${y}-0002`, `IMP-${y + 1}-0001`,
    ]);
  });

  it("DRAFT, createdById, total 0, quoteVersion 0", async () => {
    const d = await createDraft({ eventId: fx.event.id, orgId: fx.org.id, type: "ADVANCE", userId: fx.owner.id, now: NOV_2026 });
    expect(d).toMatchObject({ status: "DRAFT", createdById: fx.owner.id, total: 0, quoteVersion: 0, type: "ADVANCE" });
    expect(d.reference).toMatch(/^IMP-2026-\d{4,}$/);
  });

  it("date par défaut : année courante", async () => {
    const d = await createDraft({ eventId: fx.event.id, orgId: fx.org.id, type: "ADVANCE", userId: fx.owner.id });
    expect(d.reference.startsWith(`IMP-${new Date().getUTCFullYear()}-`)).toBe(true);
  });

  it("nextReference : plus grand suffixe + 1, même après suppression d'un évènement ; ignore les suffixes non numériques", async () => {
    const f = await seedPrintFixture();
    const y = 3000 + Math.floor(Math.random() * 900);
    const now = new Date(`${y}-05-01T00:00:00Z`);
    await makeRequest(f, { reference: `IMP-${y}-0001` });
    await makeRequest(f, { reference: `IMP-${y}-0003` });
    await makeRequest(f, { reference: `IMP-${y}-abcd` });
    expect(await run((tx) => nextReference(tx, now))).toBe(`IMP-${y}-0004`);
    await prisma.registration.deleteMany({ where: { eventId: f.event.id } });
    await prisma.event.delete({ where: { id: f.event.id } });
    expect(await run((tx) => nextReference(tx, now))).toBe(`IMP-${y}-0001`);
  });

  it("réessaie après une collision de référence", async () => {
    collideOnCreate(1);
    const d = await createDraft({ eventId: fx.event.id, orgId: fx.org.id, type: "ADVANCE", userId: fx.owner.id, now: NOV_2026 });
    expect(d.status).toBe("DRAFT");
  });

  it("abandonne après 3 collisions (P2002)", async () => {
    collideOnCreate(3);
    const err = await createDraft({ eventId: fx.event.id, orgId: fx.org.id, type: "ADVANCE", userId: fx.owner.id, now: NOV_2026 })
      .then(() => null, (e) => e);
    expect(err).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(err.code).toBe("P2002");
  });

  it("retryOnReferenceCollision : P2002 sur une autre contrainte ([requestId, kind]) n'est pas rejoué", async () => {
    const other = new Prisma.PrismaClientKnownRequestError("dup", {
      code: "P2002", clientVersion: "x", meta: { target: "OrgPrintCredit_requestId_kind_key" },
    });
    const run = vi.fn().mockRejectedValue(other);
    await expect(retryOnReferenceCollision(run)).rejects.toBe(other);
    expect(run).toHaveBeenCalledTimes(1);
    const noMeta = new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" });
    const run2 = vi.fn().mockRejectedValue(noMeta);
    await expect(retryOnReferenceCollision(run2)).rejects.toBe(noMeta);
    expect(run2).toHaveBeenCalledTimes(1);
  });

  it("retryOnReferenceCollision : cible `reference` en nom d'index ou en tableau, rejoué puis abandonné après 3 essais", async () => {
    for (const target of ["PrintRequest_reference_key", ["reference"]]) {
      const err = new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x", meta: { target } });
      const run = vi.fn().mockRejectedValueOnce(err).mockResolvedValueOnce("ok");
      expect(await retryOnReferenceCollision(run)).toBe("ok");
      expect(run).toHaveBeenCalledTimes(2);
      const always = vi.fn().mockRejectedValue(err);
      await expect(retryOnReferenceCollision(always)).rejects.toBe(err);
      expect(always).toHaveBeenCalledTimes(3);
    }
  });

  it("propage une erreur qui n'est pas une collision", async () => {
    const err = await createDraft({ eventId: "inexistant", orgId: fx.org.id, type: "ADVANCE", userId: fx.owner.id, now: NOV_2026 })
      .then(() => null, (e) => e);
    expect(err).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(err.code).not.toBe("P2002");
  });
});

describe("assertOwner", () => {
  it("OWNER passe ; MANAGER -> OWNER_REQUIRED ; STAFF_ADMIN -> STAFF_FORBIDDEN", async () => {
    await expect(assertOwner(fx.owner.id, fx.org.id)).resolves.toBeUndefined();
    expect((await reject(assertOwner(fx.manager.id, fx.org.id)))?.code).toBe("OWNER_REQUIRED");
    const staff = await reject(assertOwner(fx.staffAdmin.id, fx.org.id));
    expect([staff?.code, staff?.status]).toEqual(["STAFF_FORBIDDEN", 403]);
  });
  it("OWNER d'une autre organisation, ou utilisateur inconnu -> OWNER_REQUIRED", async () => {
    const other = await seedPrintFixture();
    expect((await reject(assertOwner(other.owner.id, fx.org.id)))?.code).toBe("OWNER_REQUIRED");
    expect((await reject(assertOwner("inconnu", fx.org.id)))?.code).toBe("OWNER_REQUIRED");
  });
});

describe("snapshotEventTemplate / loadRequest", () => {
  it("copie 320 x 460 px, 2 pages et le libellé", async () => {
    expect(await snapshotEventTemplate(fx.event.id)).toEqual({
      badgeTemplateId: fx.template.id, badgeWidthPx: 320, badgeHeightPx: 460, badgePages: 2, label: "Badge test",
    });
    expect((await run((tx) => snapshotEventTemplate(fx.event.id, tx))).badgePages).toBe(2);
  });
  it("évènement inconnu -> NOT_FOUND ; aucun template lisible -> VALIDATION", async () => {
    expect((await reject(snapshotEventTemplate("inconnu")))?.code).toBe("NOT_FOUND");
    vi.mocked(templateVars.findEffectiveTemplateRow).mockResolvedValueOnce(null);
    expect((await reject(snapshotEventTemplate(fx.event.id)))?.code).toBe("VALIDATION");
  });
  it("loadRequest : trouvée, absente ou d'un autre évènement -> 404", async () => {
    const r = await makeRequest(fx);
    expect((await loadRequest(r.id)).id).toBe(r.id);
    expect((await loadRequest(r.id, { eventId: fx.event.id })).id).toBe(r.id);
    expect((await reject(loadRequest("inconnu")))?.status).toBe(404);
    const err = await reject(loadRequest(r.id, { eventId: "autre" }));
    expect([err?.code, err?.status]).toEqual(["NOT_FOUND", 404]);
  });
});

describe("applyTransition", () => {
  it("SUBMIT pose submittedAt ; SEND_QUOTE (STAFF) -> QUOTED et quotedAt", async () => {
    const d = await makeRequest(fx, { status: "DRAFT" });
    expect(await run((tx) => applyTransition(tx, d, "SUBMIT", "ORGANIZER", NOV_2026))).toBe("SUBMITTED");
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: d.id } })).submittedAt).toEqual(NOV_2026);
    expect(await run((tx) => applyTransition(tx, { id: d.id, status: "SUBMITTED" }, "SEND_QUOTE", "STAFF", NOV_2026))).toBe("QUOTED");
    const row = await prisma.printRequest.findUniqueOrThrow({ where: { id: d.id } });
    expect([row.status, row.quotedAt]).toEqual(["QUOTED", NOV_2026]);
  });

  it("date par défaut, completedAt et cancelledAt", async () => {
    const r = await makeRequest(fx, { status: "READY" });
    await run((tx) => applyTransition(tx, r, "COMPLETE", "STAFF"));
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).completedAt).toBeInstanceOf(Date);
    const q = await makeRequest(fx, { status: "QUOTED" });
    await run((tx) => applyTransition(tx, q, "CANCEL", "ORGANIZER"));
    const row = await prisma.printRequest.findUniqueOrThrow({ where: { id: q.id } });
    expect([row.status, row.cancelledAt instanceof Date]).toEqual(["CANCELLED", true]);
  });

  it("transition non permise -> 409 INVALID_TRANSITION { from: 'PAID', action: 'CANCEL' }", async () => {
    const r = await makeRequest(fx, { status: "PAID" });
    const err = await reject(run((tx) => applyTransition(tx, r, "CANCEL", "ORGANIZER")));
    expect([err?.code, err?.status, err?.details]).toEqual(["INVALID_TRANSITION", 409, { from: "PAID", action: "CANCEL" }]);
  });

  it("statut périmé (ligne passée CANCELLED entre-temps) -> INVALID_TRANSITION", async () => {
    const r = await makeRequest(fx, { status: "SUBMITTED" });
    await prisma.printRequest.update({ where: { id: r.id }, data: { status: "CANCELLED" } });
    const err = await reject(run((tx) => applyTransition(tx, r, "SEND_QUOTE", "STAFF")));
    expect([err?.code, err?.details]).toEqual(["INVALID_TRANSITION", { from: "SUBMITTED", action: "SEND_QUOTE" }]);
  });

  const accepted = () =>
    makeRequest(fx, {
      status: "ACCEPTED", acceptedVersion: 2, acceptedTotal: 6000, acceptedAt: NOV_2026, acceptedById: fx.owner.id,
    });
  const cleared = { acceptedVersion: null, acceptedTotal: null, acceptedAt: null, acceptedById: null };

  it("ACCEPTED + REOPEN efface acceptedVersion/Total/At/ById", async () => {
    const r = await accepted();
    expect(await run((tx) => applyTransition(tx, r, "REOPEN", "STAFF"))).toBe("SUBMITTED");
    expect(await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id }, select: { acceptedVersion: true, acceptedTotal: true, acceptedAt: true, acceptedById: true } })).toEqual(cleared);
  });
  it("ACCEPTED + CANCEL efface l'acceptation ; ACCEPTED + MARK_PAID la conserve", async () => {
    const r = await accepted();
    await run((tx) => applyTransition(tx, r, "CANCEL", "ORGANIZER"));
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).acceptedTotal).toBeNull();
    const p = await accepted();
    await run((tx) => applyTransition(tx, p, "MARK_PAID", "SYSTEM", NOV_2026));
    const row = await prisma.printRequest.findUniqueOrThrow({ where: { id: p.id } });
    expect([row.status, row.paidAt, row.acceptedTotal]).toEqual(["PAID", NOV_2026, 6000]);
  });

  it.each([
    ["REOPEN", "STAFF", "ACCEPTED"],
    ["CANCEL", "ORGANIZER", "ACCEPTED"],
    ["MARK_PAID", "STAFF", "ACCEPTED"],
    ["TEMPLATE_CHANGED", "SYSTEM", "ACCEPTED"],
  ] as const)("%s (%s) refusé avec PAYMENT_IN_PROGRESS si un paiement est en cours", async (action, actor, status) => {
    const r = await makeRequest(fx, { status });
    vi.spyOn(paymentProbe, "isPaymentInProgress").mockResolvedValue(true);
    const err = await reject(run((tx) => applyTransition(tx, r, action, actor)));
    expect([err?.code, err?.status]).toEqual(["PAYMENT_IN_PROGRESS", 409]);
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe(status);
  });

  it("pas de garde de paiement pour MARK_PAID système, ni CANCEL hors ACCEPTED", async () => {
    const spy = vi.spyOn(paymentProbe, "isPaymentInProgress").mockResolvedValue(true);
    const a = await makeRequest(fx, { status: "ACCEPTED", acceptedTotal: 10 });
    await run((tx) => applyTransition(tx, a, "MARK_PAID", "SYSTEM"));
    const q = await makeRequest(fx, { status: "QUOTED" });
    await run((tx) => applyTransition(tx, q, "CANCEL", "ORGANIZER"));
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("applyEdit", () => {
  it("QUOTED -> SUBMITTED + entrée QUOTE_REVISION (auteur et côté)", async () => {
    const r = await makeRequest(fx, { status: "QUOTED" });
    const res = await run((tx) => applyEdit(tx, r, "ORGANIZER", fx.owner.id));
    expect(res).toEqual({ from: "QUOTED", to: "SUBMITTED" });
    const entries = await thread(r.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ eventType: "QUOTE_REVISION", authorId: fx.owner.id, side: "ORGANIZER" });
  });
  it("côté STAFF depuis SUBMITTED : pas d'entrée ; DRAFT organisateur reste DRAFT", async () => {
    const s = await makeRequest(fx, { status: "SUBMITTED" });
    expect(await run((tx) => applyEdit(tx, s, "STAFF", fx.staffAdmin.id))).toEqual({ from: "SUBMITTED", to: "SUBMITTED" });
    expect(await thread(s.id)).toHaveLength(0);
    const d = await makeRequest(fx, { status: "DRAFT" });
    expect(await run((tx) => applyEdit(tx, d, "ORGANIZER", fx.owner.id))).toEqual({ from: "DRAFT", to: "DRAFT" });
  });
  it("ACCEPTED -> QUOTE_ACCEPTED ; PAID -> REQUEST_LOCKED ; DRAFT côté staff -> REQUEST_LOCKED", async () => {
    const a = await makeRequest(fx, { status: "ACCEPTED" });
    expect((await reject(run((tx) => applyEdit(tx, a, "ORGANIZER", fx.owner.id))))?.code).toBe("QUOTE_ACCEPTED");
    const p = await makeRequest(fx, { status: "PAID" });
    expect((await reject(run((tx) => applyEdit(tx, p, "STAFF", fx.staffAdmin.id))))?.code).toBe("REQUEST_LOCKED");
    const d = await makeRequest(fx, { status: "DRAFT" });
    expect((await reject(run((tx) => applyEdit(tx, d, "STAFF", fx.staffAdmin.id))))?.code).toBe("REQUEST_LOCKED");
  });
});

describe("recomputeTotal / requestBadgeCount", () => {
  it("4500 + 1500 + une ligne retirée de 999 -> 6000", async () => {
    const r = await makeRequest(fx);
    const line = (lineTotal: number, position: number, removedAt: Date | null = null) =>
      prisma.printQuoteLine.create({
        data: { requestId: r.id, kind: "CUSTOM", label: "L", quantity: 1, unitPrice: lineTotal, lineTotal, position, addedBy: "STAFF", removedAt },
      });
    await line(4500, 0);
    await line(1500, 1);
    await line(999, 2, new Date());
    expect(await run((tx) => recomputeTotal(tx, r.id))).toBe(6000);
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).total).toBe(6000);
  });
  it("aucune ligne -> 0", async () => {
    const r = await makeRequest(fx, { total: 50 });
    expect(await run((tx) => recomputeTotal(tx, r.id))).toBe(0);
  });
  it("ADVANCE : nombre d'items ; ONSITE : estimatedQuantity ?? 0", async () => {
    const adv = await makeRequest(fx, { type: "ADVANCE" });
    await prisma.printRequestItem.createMany({
      data: fx.approved.slice(0, 2).map((reg, i) => ({ requestId: adv.id, registrationId: reg.id, position: i })),
    });
    expect(await run((tx) => requestBadgeCount(tx, adv))).toBe(2);
    expect(await run((tx) => requestBadgeCount(tx, { id: "x", type: "ONSITE", estimatedQuantity: 120 }))).toBe(120);
    expect(await run((tx) => requestBadgeCount(tx, { id: "x", type: "ONSITE", estimatedQuantity: null }))).toBe(0);
  });
});

describe("markPaid", () => {
  it("une erreur de verrou qui n'est pas NOT_FOUND est relancée telle quelle", async () => {
    const r = await makeRequest(fx, { status: "ACCEPTED", acceptedTotal: 6000, acceptedVersion: 1 });
    const boom = new Error("verrou en échec");
    const tx = { $queryRaw: vi.fn().mockRejectedValue(boom) } as unknown as Prisma.TransactionClient;
    await expect(markPaid(tx, r.id, {})).rejects.toBe(boom);
  });

  const accepted = () => makeRequest(fx, { status: "ACCEPTED", acceptedTotal: 6000, acceptedVersion: 1 });

  it("ACCEPTED (6000) -> true, PAID, paidAt, entrée « Paiement reçu : 6 000 FCFA »", async () => {
    const r = await accepted();
    expect(await run((tx) => markPaid(tx, r.id, {}))).toBe(true);
    const row = await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } });
    expect(row.status).toBe("PAID");
    expect(row.paidAt).toBeInstanceOf(Date);
    expect(row.paidPaymentId).toBeNull();
    const [entry] = await thread(r.id);
    expect(entry).toMatchObject({ eventType: "PAYMENT_RECEIVED", side: "SYSTEM", authorId: null });
    expect(entry.body).toBe(`Paiement reçu : ${formatFcfa(6000)}`);
    expect(entry.details).toEqual({ amount: 6000 });
  });
  it("avec paymentId -> paidPaymentId posé", async () => {
    const r = await accepted();
    await run((tx) => markPaid(tx, r.id, { paymentId: "pay_1" }));
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).paidPaymentId).toBe("pay_1");
    expect((await thread(r.id))[0].details).toEqual({ amount: 6000, paymentId: "pay_1" });
  });
  it("manuel : paidPaymentId null, entrée suffixée, auteur staff, côté STAFF", async () => {
    const r = await accepted();
    await run((tx) => markPaid(tx, r.id, { manual: { userId: fx.staffAdmin.id, reason: "virement du 30/10" } }));
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).paidPaymentId).toBeNull();
    const [entry] = await thread(r.id);
    expect(entry).toMatchObject({ side: "STAFF", authorId: fx.staffAdmin.id });
    expect(entry.body).toBe(`Paiement reçu : ${formatFcfa(6000)} (hors ligne : virement du 30/10)`);
  });
  it("manuel avec paiement en cours -> PAYMENT_IN_PROGRESS, rien d'écrit", async () => {
    const r = await accepted();
    vi.spyOn(paymentProbe, "isPaymentInProgress").mockResolvedValue(true);
    const err = await reject(run((tx) => markPaid(tx, r.id, { manual: { userId: fx.staffAdmin.id, reason: "x" } })));
    expect(err?.code).toBe("PAYMENT_IN_PROGRESS");
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("ACCEPTED");
  });
  it("deux markPaid simultanés : un seul vrai, l'autre false, une seule entrée", async () => {
    const r = await accepted();
    const results = await Promise.all([
      prisma.$transaction((tx) => markPaid(tx, r.id, { paymentId: "pay_a" })),
      prisma.$transaction((tx) => markPaid(tx, r.id, { paymentId: "pay_b" })),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const row = await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } });
    expect(row.status).toBe("PAID");
    expect(["pay_a", "pay_b"]).toContain(row.paidPaymentId);
    expect((await thread(r.id)).filter((m) => m.eventType === "PAYMENT_RECEIVED")).toHaveLength(1);
  });
  it("montant absent (acceptedTotal null) -> 0", async () => {
    const r = await makeRequest(fx, { status: "ACCEPTED" });
    await run((tx) => markPaid(tx, r.id, {}));
    expect((await thread(r.id))[0].details).toEqual({ amount: 0 });
  });
  it("QUOTED ou commande inconnue -> false, commande inchangée, aucune entrée", async () => {
    const r = await makeRequest(fx, { status: "QUOTED" });
    expect(await run((tx) => markPaid(tx, r.id, {}))).toBe(false);
    const row = await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } });
    expect([row.status, row.paidAt, row.paidPaymentId]).toEqual(["QUOTED", null, null]);
    expect(await thread(r.id)).toHaveLength(0);
    expect(await run((tx) => markPaid(tx, "inconnue", {}))).toBe(false);
  });
});

describe("isPaymentInProgress / réexport", () => {
  it("vaut false par défaut et suit paymentProbe", async () => {
    expect(await isPaymentInProgress("x")).toBe(false);
    vi.spyOn(paymentProbe, "isPaymentInProgress").mockResolvedValue(true);
    expect(await isPaymentInProgress("x")).toBe(true);
  });
  it("isPaymentInProgress vrai avec un Payment PENDING de la commande, faux avec APPROVED, EXPIRED ou le PENDING d'une autre commande", async () => {
    const base = { orgId: fx.org.id, purpose: "PRINT_REQUEST" as const, userId: fx.owner.id, amount: 1000 };
    const r = await makeRequest(fx, { status: "ACCEPTED", acceptedTotal: 1000 });
    const other = await makeRequest(fx, { status: "ACCEPTED", acceptedTotal: 1000 });
    await prisma.payment.create({ data: { ...base, printRequestId: r.id, status: "APPROVED" } });
    await prisma.payment.create({ data: { ...base, printRequestId: r.id, status: "EXPIRED" } });
    await prisma.payment.create({ data: { ...base, printRequestId: other.id, status: "PENDING" } });
    expect(await isPaymentInProgress(r.id)).toBe(false);
    await prisma.payment.create({ data: { ...base, printRequestId: r.id, status: "PENDING" } });
    expect(await isPaymentInProgress(r.id)).toBe(true);
  });
  it("réexporte appendThreadEvent", () => {
    expect(typeof appendThreadEvent).toBe("function");
  });
});
