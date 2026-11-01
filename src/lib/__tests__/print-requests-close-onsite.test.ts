import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { PrintRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { closeOnsiteRequest } from "@/lib/print-requests/close-onsite";
import { advanceStatus } from "@/lib/print-requests/quote";
import { getOrgPrintCreditBalance } from "@/lib/print-requests/org-credit";
import { formatFcfa } from "@/lib/print-requests/labels";
import { seedPrintFixture, makeRequest, type PrintFixture } from "./helpers/print-requests";

let fx: PrintFixture;
beforeEach(async () => {
  vi.restoreAllMocks();
  fx = await seedPrintFixture();
});

const fail = async (p: Promise<unknown>) =>
  p.then(() => null, (e) => e as { code: string; httpStatus?: number; status?: number });
const reload = (id: string) => prisma.printRequest.findUniqueOrThrow({ where: { id } });
const thread = (id: string, eventType?: string) =>
  prisma.printRequestMessage.findMany({
    where: { requestId: id, ...(eventType ? { eventType } : {}) },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
const movements = (orgId = fx.org.id) => prisma.orgPrintCredit.findMany({ where: { orgId } });
const children = (parentId: string) => prisma.printRequest.findMany({ where: { parentRequestId: parentId } });

// Demande sur place avec une ligne BADGE (ordered à unitPrice) et `printed` premières impressions.
async function onsite(opts: {
  ordered?: number;
  unitPrice?: number;
  marginPercent?: number | null;
  printed?: number;
  reprints?: number;
  status?: PrintRequestStatus;
  lines?: boolean;
  over?: Partial<Prisma.PrintRequestUncheckedCreateInput>;
}) {
  const { ordered = 200, unitPrice = 1500, printed = 0, reprints = 0, status = "COMPLETED" } = opts;
  const r = await makeRequest(fx, {
    type: "ONSITE", status, estimatedQuantity: ordered,
    marginPercent: opts.marginPercent === undefined ? 10 : opts.marginPercent,
    badgeTemplateId: fx.template.id, badgeWidthPx: 320, badgeHeightPx: 460, badgePages: 2,
    completedAt: new Date(), ...opts.over,
  });
  if (opts.lines !== false) {
    await prisma.printQuoteLine.create({
      data: {
        requestId: r.id, kind: "PRODUCT", productId: fx.badgeProduct.id, label: "Support badge PVC",
        optionsSnapshot: [{ optionId: "o1", label: "Finition", supplement: 0 }],
        choices: [{ optionId: "o1", value: "mat" }],
        quantity: ordered, unitPrice, lineTotal: ordered * unitPrice, position: 0, addedBy: "ORGANIZER",
      },
    });
  }
  await prisma.printRequestPrint.createMany({
    data: [
      ...Array.from({ length: printed }, () => ({ requestId: r.id, registrationId: null, reprint: false })),
      ...Array.from({ length: reprints }, () => ({ requestId: r.id, registrationId: null, reprint: true })),
    ],
  });
  return r;
}

describe("closeOnsiteRequest : crédit", () => {
  it("200 commandés à 1 500 FCFA, 170 imprimés + 5 réimpressions : CREDIT 45 000, 30 non utilisés", async () => {
    const r = await onsite({ printed: 170, reprints: 5 });
    // Un accessoire ne compte pas dans le crédit.
    await prisma.printQuoteLine.create({
      data: {
        requestId: r.id, kind: "PRODUCT", productId: fx.lanyard.id, label: "Cordon", quantity: 200,
        unitPrice: 500, lineTotal: 100000, position: 1, addedBy: "ORGANIZER",
      },
    });
    expect(await closeOnsiteRequest(r.id)).toEqual({ outcome: "CREDIT", amount: 45000, unusedBadges: 30 });
    expect(await movements()).toMatchObject([
      { kind: "EARNED", amount: 45000, quantity: 30, unitPrice: 1500, requestId: r.id, orgId: fx.org.id, createdById: null },
    ]);
    expect(await getOrgPrintCreditBalance(fx.org.id)).toBe(45000);
    const entries = await thread(r.id, "ONSITE_CREDIT_EARNED");
    expect(entries).toHaveLength(1);
    expect(entries[0].body).toBe(`30 badges non utilisés : ${formatFcfa(45000)} versés au crédit d'impression`);
    expect(entries[0].details).toEqual({ quantity: 30, amount: 45000 });
    expect(await children(r.id)).toHaveLength(0);
  });

  it("l'auteur du mouvement est l'utilisateur fourni", async () => {
    const r = await onsite({ printed: 199 });
    await closeOnsiteRequest(r.id, fx.staffAdmin.id);
    expect(await movements()).toMatchObject([{ amount: 1500, quantity: 1, createdById: fx.staffAdmin.id }]);
  });

  it("rien d'imprimé : tout est rendu ; marge nulle (null) traitée comme 0", async () => {
    const r = await onsite({ printed: 0, marginPercent: null });
    expect(await closeOnsiteRequest(r.id)).toEqual({ outcome: "CREDIT", amount: 300000, unusedBadges: 200 });
  });

  it("rejouée : même résultat, un seul mouvement, une seule entrée du fil", async () => {
    const r = await onsite({ printed: 170 });
    const first = await closeOnsiteRequest(r.id);
    expect(await closeOnsiteRequest(r.id)).toEqual(first);
    expect(await movements()).toHaveLength(1);
    expect(await thread(r.id, "ONSITE_CREDIT_EARNED")).toHaveLength(1);
    expect(await getOrgPrintCreditBalance(fx.org.id)).toBe(45000);
  });

  it("deux clôtures concurrentes : un seul mouvement, résultats identiques", async () => {
    const r = await onsite({ printed: 170 });
    const [a, b] = await Promise.all([closeOnsiteRequest(r.id), closeOnsiteRequest(r.id)]);
    expect(a).toEqual({ outcome: "CREDIT", amount: 45000, unusedBadges: 30 });
    expect(b).toEqual(a);
    expect(await movements()).toHaveLength(1);
    expect(await thread(r.id, "ONSITE_CREDIT_EARNED")).toHaveLength(1);
  });

  it("badge à 0 FCFA : rien à verser, NONE", async () => {
    const r = await onsite({ printed: 10, unitPrice: 0 });
    expect(await closeOnsiteRequest(r.id)).toEqual({ outcome: "NONE" });
    expect(await movements()).toHaveLength(0);
  });
});

describe("closeOnsiteRequest : demande complémentaire", () => {
  it("200 commandés, marge 10 %, 212 imprimés : SUPPLEMENT de 12 badges, 18 000 FCFA, en QUOTED", async () => {
    const r = await onsite({ printed: 212, reprints: 3 });
    const closure = await closeOnsiteRequest(r.id);
    const [child] = await children(r.id);
    expect(closure).toEqual({ outcome: "SUPPLEMENT", supplementRequestId: child.id, extraBadges: 12, total: 18000 });
    expect(child).toMatchObject({
      type: "ONSITE", status: "QUOTED", parentRequestId: r.id, eventId: fx.event.id, orgId: fx.org.id,
      createdById: fx.owner.id, quoteVersion: 1, total: 18000, estimatedQuantity: 12, marginPercent: 0,
      badgeTemplateId: fx.template.id, badgeWidthPx: 320, badgeHeightPx: 460, badgePages: 2,
      templatePinned: false, acceptedVersion: null, paidAt: null,
    });
    expect(child.reference).toMatch(/^IMP-\d{4}-\d{4}$/);
    expect(child.reference).not.toBe(r.reference);
    expect(child.submittedAt).not.toBeNull();
    expect(child.quotedAt).not.toBeNull();
    const lines = await prisma.printQuoteLine.findMany({ where: { requestId: child.id } });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      kind: "PRODUCT", label: "Badges supplémentaires", productId: fx.badgeProduct.id, quantity: 12,
      unitPrice: 1500, lineTotal: 18000, position: 0, addedBy: "STAFF", usesOrgCredit: false, removedAt: null,
      optionsSnapshot: [{ optionId: "o1", label: "Finition", supplement: 0 }],
      choices: [{ optionId: "o1", value: "mat" }],
    });
    // Le surplus et le crédit s'excluent.
    expect(await movements()).toHaveLength(0);
    const text = `Demande complémentaire ${child.reference} : 12 badges supplémentaires`;
    for (const id of [r.id, child.id]) {
      const entries = await thread(id, "ONSITE_SUPPLEMENT_CREATED");
      expect(entries).toHaveLength(1);
      expect(entries[0].body).toBe(text);
    }
  });

  it("ligne sans options ni choix : copiée telle quelle (JSON nul)", async () => {
    const r = await onsite({ printed: 201, marginPercent: null, lines: false });
    await prisma.printQuoteLine.create({
      data: {
        requestId: r.id, kind: "PRODUCT", productId: fx.badgeProduct.id, label: "Badge", quantity: 200,
        unitPrice: 1500, lineTotal: 300000, position: 0, addedBy: "ORGANIZER",
      },
    });
    expect(await closeOnsiteRequest(r.id)).toMatchObject({ outcome: "SUPPLEMENT", extraBadges: 1, total: 1500 });
    const [child] = await children(r.id);
    const [line] = await prisma.printQuoteLine.findMany({ where: { requestId: child.id } });
    expect(line.optionsSnapshot).toBeNull();
    expect(line.choices).toBeNull();
  });

  it("rejouée : aucune seconde demande complémentaire, même résultat", async () => {
    const r = await onsite({ printed: 212 });
    const first = await closeOnsiteRequest(r.id);
    expect(await closeOnsiteRequest(r.id)).toEqual(first);
    expect(await children(r.id)).toHaveLength(1);
    expect(await thread(r.id, "ONSITE_SUPPLEMENT_CREATED")).toHaveLength(1);
  });

  it("deux clôtures concurrentes : une seule demande complémentaire", async () => {
    const r = await onsite({ printed: 212 });
    const [a, b] = await Promise.all([closeOnsiteRequest(r.id), closeOnsiteRequest(r.id)]);
    expect(b).toEqual(a);
    expect(await children(r.id)).toHaveLength(1);
  });
});

describe("règles de la ligne BADGE et plafond", () => {
  const secondBadge = (requestId: string) =>
    prisma.printQuoteLine.create({
      data: {
        requestId, kind: "PRODUCT", productId: fx.badgeProduct.id, label: "Autre badge", quantity: 50,
        unitPrice: 1000, lineTotal: 50000, position: 1, addedBy: "STAFF",
      },
    });

  it("seule la première ligne BADGE compte pour le crédit", async () => {
    const r = await onsite({ printed: 170 });
    await secondBadge(r.id);
    expect(await closeOnsiteRequest(r.id)).toEqual({ outcome: "CREDIT", amount: 45000, unusedBadges: 30 });
  });

  it("seule la première ligne BADGE compte pour le surplus", async () => {
    const r = await onsite({ printed: 212 });
    await secondBadge(r.id);
    expect(await closeOnsiteRequest(r.id)).toMatchObject({ outcome: "SUPPLEMENT", extraBadges: 12, total: 18000 });
  });

  it("badge à 0 FCFA avec surplus : NONE, aucune demande à 0 FCFA", async () => {
    const r = await onsite({ printed: 212, unitPrice: 0 });
    expect(await closeOnsiteRequest(r.id)).toEqual({ outcome: "NONE" });
    expect(await children(r.id)).toHaveLength(0);
  });

  it("surplus dont le total dépasse MAX_AMOUNT : quantité plafonnée, total <= MAX_AMOUNT", async () => {
    const r = await onsite({ ordered: 1, unitPrice: 1_000_000_000, marginPercent: 300, printed: 4 });
    const closure = await closeOnsiteRequest(r.id);
    expect(closure).toMatchObject({ outcome: "SUPPLEMENT", extraBadges: 2, total: 2_000_000_000 });
    expect((await children(r.id))[0]).toMatchObject({ estimatedQuantity: 2, total: 2_000_000_000 });
  });

  it("prix unitaire supérieur à MAX_AMOUNT : plafonné à 0 badge, NONE", async () => {
    const r = await onsite({ ordered: 1, unitPrice: 2_100_000_000, marginPercent: 300, printed: 2 });
    expect(await closeOnsiteRequest(r.id)).toEqual({ outcome: "NONE" });
  });
});

describe("closeOnsiteRequest : rien à faire et refus", () => {
  it("200 imprimés sur 200 : NONE, rien n'est créé, y compris à la relecture", async () => {
    const r = await onsite({ printed: 200 });
    expect(await closeOnsiteRequest(r.id)).toEqual({ outcome: "NONE" });
    expect(await closeOnsiteRequest(r.id)).toEqual({ outcome: "NONE" });
    expect(await movements()).toHaveLength(0);
    expect(await children(r.id)).toHaveLength(0);
    expect(await thread(r.id)).toHaveLength(0);
  });

  it("aucune ligne, ou ligne BADGE retirée, ou accessoires seuls : NONE", async () => {
    const none = await onsite({ printed: 5, lines: false });
    expect(await closeOnsiteRequest(none.id)).toEqual({ outcome: "NONE" });

    const removed = await onsite({ printed: 5 });
    await prisma.printQuoteLine.updateMany({ where: { requestId: removed.id }, data: { removedAt: new Date() } });
    expect(await closeOnsiteRequest(removed.id)).toEqual({ outcome: "NONE" });

    const accessory = await onsite({ printed: 5, lines: false });
    await prisma.printQuoteLine.create({
      data: {
        requestId: accessory.id, kind: "PRODUCT", productId: fx.lanyard.id, label: "Cordon", quantity: 200,
        unitPrice: 500, lineTotal: 100000, position: 0, addedBy: "ORGANIZER",
      },
    });
    expect(await closeOnsiteRequest(accessory.id)).toEqual({ outcome: "NONE" });
    expect(await movements()).toHaveLength(0);
  });

  it("demande READY, demande complémentaire, demande en amont : NOT_CLOSABLE 409 ; inconnue : NOT_FOUND", async () => {
    const ready = await onsite({ printed: 170, status: "READY" });
    expect(await fail(closeOnsiteRequest(ready.id))).toMatchObject({ code: "NOT_CLOSABLE", httpStatus: 409 });

    const parent = await onsite({ printed: 200 });
    const child = await onsite({ printed: 170, over: { parentRequestId: parent.id } });
    expect(await fail(closeOnsiteRequest(child.id))).toMatchObject({ code: "NOT_CLOSABLE", httpStatus: 409 });

    const advance = await onsite({ printed: 170, over: { type: "ADVANCE" } });
    expect(await fail(closeOnsiteRequest(advance.id))).toMatchObject({ code: "NOT_CLOSABLE" });

    expect(await fail(closeOnsiteRequest("inconnue"))).toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(await movements()).toHaveLength(0);
  });
});

// Provoque des collisions de référence : avant le create de la demande complémentaire, une
// demande de la même référence est insérée (sur un autre évènement, dont le verrou n'est pas tenu).
function collideOnCreate(times: number, otherEventId: string) {
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
                    data: { reference: args.data.reference, eventId: otherEventId, orgId: fx.org.id, type: "ADVANCE" },
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

async function otherEvent() {
  return prisma.event.create({
    data: { orgId: fx.org.id, title: "Autre", slug: `autre-${Date.now()}`, location: "X", date: new Date() },
  });
}

describe("référence de la demande complémentaire", () => {
  it("collision de référence : la clôture est rejouée et aboutit avec la référence suivante", async () => {
    const other = await otherEvent();
    const r = await onsite({ printed: 212 });
    collideOnCreate(1, other.id);
    const closure = await closeOnsiteRequest(r.id);
    expect(closure).toMatchObject({ outcome: "SUPPLEMENT", extraBadges: 12 });
    const [child] = await children(r.id);
    expect(child.reference).toMatch(/^IMP-\d{4}-\d{4}$/);
    expect(await children(r.id)).toHaveLength(1);
    expect(await thread(r.id, "ONSITE_SUPPLEMENT_CREATED")).toHaveLength(1);
  });

  it("trois collisions : P2002, rien n'est écrit", async () => {
    const other = await otherEvent();
    const r = await onsite({ printed: 212 });
    collideOnCreate(3, other.id);
    const err = await closeOnsiteRequest(r.id).then(() => null, (e) => e);
    expect(err).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(err.code).toBe("P2002");
    expect(await children(r.id)).toHaveLength(0);
    expect(await thread(r.id)).toHaveLength(0);
  });
});

describe("clôture dans advanceStatus (READY -> COMPLETED)", () => {
  const to = (id: string) => advanceStatus({ requestId: id, userId: fx.staffAdmin.id, to: "COMPLETED" });

  it("demande sur place : closure CREDIT renvoyée, mouvement créé dans la même transaction", async () => {
    const r = await onsite({ printed: 170, status: "READY", over: { completedAt: null } });
    const done = await to(r.id);
    expect(done.status).toBe("COMPLETED");
    expect(done.previousStatus).toBe("READY");
    expect(done.closure).toEqual({ outcome: "CREDIT", amount: 45000, unusedBadges: 30 });
    expect(await movements()).toMatchObject([{ kind: "EARNED", amount: 45000, requestId: r.id, createdById: fx.staffAdmin.id }]);
    expect((await thread(r.id)).map((m) => m.eventType)).toEqual(["STATUS_CHANGED", "ONSITE_CREDIT_EARNED"]);
  });

  it("surplus : closure SUPPLEMENT, demande complémentaire QUOTED", async () => {
    const r = await onsite({ printed: 212, status: "READY", over: { completedAt: null } });
    const done = await to(r.id);
    const [child] = await children(r.id);
    expect(done.closure).toEqual({ outcome: "SUPPLEMENT", supplementRequestId: child.id, extraBadges: 12, total: 18000 });
    expect(child.status).toBe("QUOTED");
  });

  it("commande exacte : closure NONE", async () => {
    const r = await onsite({ printed: 200, status: "READY", over: { completedAt: null } });
    expect((await to(r.id)).closure).toEqual({ outcome: "NONE" });
  });

  it("demande en amont ou demande complémentaire : pas de clôture", async () => {
    const advance = await onsite({ printed: 170, status: "READY", over: { type: "ADVANCE", completedAt: null } });
    expect((await to(advance.id)).closure).toBeUndefined();
    const parent = await onsite({ printed: 200 });
    const child = await onsite({ printed: 170, status: "READY", over: { parentRequestId: parent.id, completedAt: null } });
    expect((await to(child.id)).closure).toBeUndefined();
    expect(await movements()).toHaveLength(0);
  });

  it("les autres transitions ne ferment rien", async () => {
    const r = await onsite({ printed: 170, status: "PAID", over: { completedAt: null, badgeTemplateId: null } });
    const started = await advanceStatus({ requestId: r.id, userId: fx.staffAdmin.id, to: "IN_PRODUCTION" });
    expect(started.closure).toBeUndefined();
    expect(await movements()).toHaveLength(0);
  });

  it("deux passages à COMPLETED concurrents : un seul réussit, un seul mouvement", async () => {
    const r = await onsite({ printed: 170, status: "READY", over: { completedAt: null } });
    const res = await Promise.allSettled([to(r.id), to(r.id)]);
    expect(res.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await movements()).toHaveLength(1);
    expect(await thread(r.id, "ONSITE_CREDIT_EARNED")).toHaveLength(1);
  });

  it("collision de référence : toute la transaction est rejouée (statut, fil et demande complémentaire une seule fois)", async () => {
    const other = await otherEvent();
    const r = await onsite({ printed: 212, status: "READY", over: { completedAt: null } });
    collideOnCreate(1, other.id);
    const done = await to(r.id);
    expect(done.closure).toMatchObject({ outcome: "SUPPLEMENT" });
    expect(await children(r.id)).toHaveLength(1);
    expect(await thread(r.id, "STATUS_CHANGED")).toHaveLength(1);
    expect(await thread(r.id, "ONSITE_SUPPLEMENT_CREATED")).toHaveLength(1);
  });

  it("échec de la clôture : la demande reste READY, rien n'est écrit", async () => {
    const other = await otherEvent();
    const r = await onsite({ printed: 212, status: "READY", over: { completedAt: null } });
    collideOnCreate(3, other.id);
    const err = await to(r.id).then(() => null, (e) => e);
    expect(err).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    const after = await reload(r.id);
    expect(after.status).toBe("READY");
    expect(after.completedAt).toBeNull();
    expect(await thread(r.id)).toHaveLength(0);
    expect(await children(r.id)).toHaveLength(0);
  });
});
