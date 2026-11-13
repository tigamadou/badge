import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { PrintRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { makeStaff } from "@/test/factories";
import { formatFcfa } from "@/lib/print-catalog/pricing";
import { PrintRequestError, PRINT_REQUEST_ERROR_MESSAGES } from "@/lib/print-requests/errors";
import { staffLineSchema, staffLinePatchSchema } from "@/lib/print-requests/inputs";
import {
  addStaffLine,
  advanceStatus,
  markPaidManually,
  rejectRequest,
  removeStaffLine,
  reopenQuote,
  sendQuote,
  summarizeQuoteDiff,
  updateStaffLine,
} from "@/lib/print-requests/quote";
import { applyOrgCredit } from "@/lib/print-requests/org-credit";
import { applyTransition, paymentProbe } from "@/lib/print-requests/service";
import { describeLineChange } from "@/lib/print-requests/thread";
import { seedPrintFixture, makeRequest, type PrintFixture } from "./helpers/print-requests";

let fx: PrintFixture;
beforeEach(async () => {
  fx = await seedPrintFixture();
});
afterEach(() => vi.restoreAllMocks());

const reject = async (p: Promise<unknown>) => p.then(() => null, (e) => e as PrintRequestError);
const thread = (id: string) =>
  prisma.printRequestMessage.findMany({ where: { requestId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
const reload = (id: string) => prisma.printRequest.findUniqueOrThrow({ where: { id } });
const activeLines = (id: string) =>
  prisma.printQuoteLine.findMany({ where: { requestId: id, removedAt: null }, orderBy: { position: "asc" } });

// Commande avec un support (3 x 1500) et un cordon (3 x 500) : total 6000.
async function requestWithLines(status: PrintRequestStatus = "SUBMITTED", extra = {}) {
  const r = await makeRequest(fx, { status, total: 6000, ...extra });
  const support = await prisma.printQuoteLine.create({
    data: {
      requestId: r.id, kind: "PRODUCT", productId: fx.badgeProduct.id, label: "Support badge PVC",
      quantity: 3, unitPrice: 1500, lineTotal: 4500, position: 0, addedBy: "ORGANIZER",
    },
  });
  const cordon = await prisma.printQuoteLine.create({
    data: {
      requestId: r.id, kind: "PRODUCT", productId: fx.lanyard.id, label: "Cordon",
      quantity: 3, unitPrice: 500, lineTotal: 1500, position: 1, addedBy: "ORGANIZER",
    },
  });
  return { r, support, cordon };
}
const staff = () => fx.staffAdmin.id;
const service = (requestId: string, over = {}) => ({
  requestId, userId: staff(),
  line: { kind: "SERVICE" as const, label: "Frais de livraison", quantity: 1, unitPrice: 5000, ...over },
});

describe("schémas", () => {
  const base = { kind: "SERVICE", label: "x", quantity: 1, unitPrice: 10 };
  it("staffLineSchema : signe selon le type, produit requis, bornes", () => {
    expect(staffLineSchema.safeParse(base).success).toBe(true);
    expect(staffLineSchema.safeParse({ ...base, kind: "DISCOUNT", unitPrice: -5 }).success).toBe(true);
    expect(staffLineSchema.safeParse({ ...base, kind: "DISCOUNT", unitPrice: 0 }).success).toBe(true);
    expect(staffLineSchema.safeParse({ ...base, kind: "DISCOUNT", unitPrice: 100 }).success).toBe(false);
    expect(staffLineSchema.safeParse({ ...base, unitPrice: -100 }).success).toBe(false);
    expect(staffLineSchema.safeParse({ ...base, kind: "PRODUCT" }).success).toBe(false);
    expect(staffLineSchema.safeParse({ ...base, kind: "PRODUCT", productId: "p" }).success).toBe(true);
    expect(staffLineSchema.safeParse({ ...base, label: "" }).success).toBe(false);
    expect(staffLineSchema.safeParse({ ...base, label: "a".repeat(201) }).success).toBe(false);
    expect(staffLineSchema.safeParse({ ...base, quantity: 0 }).success).toBe(false);
    expect(staffLineSchema.safeParse({ ...base, unitPrice: 10_000_001 }).success).toBe(false);
  });
  it("staffLinePatchSchema : au moins un champ", () => {
    expect(staffLinePatchSchema.safeParse({}).success).toBe(false);
    expect(staffLinePatchSchema.safeParse({ unitPrice: 5 }).success).toBe(true);
    expect(staffLinePatchSchema.safeParse({ label: "x", quantity: 2 }).success).toBe(true);
    expect(staffLinePatchSchema.safeParse({ quantity: 0 }).success).toBe(false);
  });
});

describe("describeLineChange — intitulé seul", () => {
  it("sans différence de quantité ni de prix, pas de parenthèses vides", () => {
    const q = { quantity: 1, unitPrice: 5 };
    expect(describeLineChange({ op: "UPDATED", lineId: "l", label: "Nouveau", from: q, to: q })).toBe(
      "Ligne modifiée : Nouveau",
    );
  });
});

describe("modifications du staff : une entrée interne par enregistrement", () => {
  it("prix du support 1500 -> 1200 puis ligne de service : deux entrées internes, total recalculé, statut SUBMITTED", async () => {
    const { r, support } = await requestWithLines();
    const upd = await updateStaffLine({ requestId: r.id, lineId: support.id, userId: staff(), patch: { unitPrice: 1200 } });
    expect(upd.revised).toBe(false);
    expect(upd.line).toMatchObject({ unitPrice: 1200, lineTotal: 3600, priceOverridden: true, quantityOverridden: false });
    const added = await addStaffLine(service(r.id));
    expect(added.line).toMatchObject({
      kind: "SERVICE", addedBy: "STAFF", position: 2, lineTotal: 5000, productId: null,
      priceOverridden: false, quantityOverridden: false,
    });
    const after = await reload(r.id);
    expect(after.total).toBe(3600 + 1500 + 5000);
    expect(after.status).toBe("SUBMITTED");
    const entries = (await thread(r.id)).filter((m) => m.kind === "EVENT");
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.eventType === "LINES_CHANGED" && e.side === "STAFF" && e.authorId === staff() && e.internal)).toBe(true);
    expect(entries.map((e) => (e.details as { changes: { op: string }[] }).changes.map((c) => c.op))).toEqual([["UPDATED"], ["ADDED"]]);
    expect(await reject(prisma.$transaction((tx) => applyTransition(tx, r, "ACCEPT", "ORGANIZER")))).toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("quantité modifiée : quantityOverridden, entrée avec from/to ; libellé seul sans drapeau", async () => {
    const { r, cordon } = await requestWithLines();
    const res = await updateStaffLine({ requestId: r.id, lineId: cordon.id, userId: staff(), patch: { quantity: 5 } });
    expect(res.line).toMatchObject({ quantity: 5, lineTotal: 2500, quantityOverridden: true, priceOverridden: false });
    const res2 = await updateStaffLine({ requestId: r.id, lineId: cordon.id, userId: staff(), patch: { label: "Cordon bleu" } });
    expect(res2.line).toMatchObject({ label: "Cordon bleu", quantityOverridden: true, priceOverridden: false });
    const entries = (await thread(r.id)).filter((m) => m.kind === "EVENT");
    expect(entries).toHaveLength(2);
    expect((entries[0].details as { changes: { from: unknown; to: unknown }[] }).changes[0]).toMatchObject({
      from: { quantity: 3, unitPrice: 500 }, to: { quantity: 5, unitPrice: 500 },
    });
  });

  it("modification sans effet : rien d'écrit, devis QUOTED non révisé", async () => {
    const { r, cordon } = await requestWithLines("QUOTED");
    const res = await updateStaffLine({ requestId: r.id, lineId: cordon.id, userId: staff(), patch: { quantity: 3, unitPrice: 500 } });
    expect(res.revised).toBe(false);
    expect(res.line.priceOverridden).toBe(false);
    expect((await reload(r.id)).status).toBe("QUOTED");
    expect(await thread(r.id)).toHaveLength(0);
  });

  it("depuis QUOTED : QUOTE_REVISION d'abord, puis LINES_CHANGED ; revised vrai", async () => {
    const { r, cordon } = await requestWithLines("QUOTED");
    const res = await updateStaffLine({ requestId: r.id, lineId: cordon.id, userId: staff(), patch: { unitPrice: 400 } });
    expect(res.revised).toBe(true);
    expect((await reload(r.id)).status).toBe("SUBMITTED");
    expect((await thread(r.id)).map((m) => m.eventType)).toEqual(["QUOTE_REVISION", "LINES_CHANGED"]);
  });

  it("retrait : removedAt, entrée REMOVED, total recalculé", async () => {
    const { r, cordon } = await requestWithLines("QUOTED");
    const res = await removeStaffLine({ requestId: r.id, lineId: cordon.id, userId: staff() });
    expect(res.revised).toBe(true);
    expect((await prisma.printQuoteLine.findUniqueOrThrow({ where: { id: cordon.id } })).removedAt).not.toBeNull();
    expect((await reload(r.id)).total).toBe(4500);
    const entry = (await thread(r.id)).find((m) => m.eventType === "LINES_CHANGED")!;
    expect(entry.body).toBe("Ligne retirée : Cordon");
  });

  it("ligne retirée ou d'une autre commande -> 404 ; commande inconnue -> 404", async () => {
    const { r, cordon } = await requestWithLines();
    const other = await requestWithLines();
    await removeStaffLine({ requestId: r.id, lineId: cordon.id, userId: staff() });
    expect(await reject(removeStaffLine({ requestId: r.id, lineId: cordon.id, userId: staff() }))).toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(await reject(updateStaffLine({ requestId: r.id, lineId: cordon.id, userId: staff(), patch: { quantity: 2 } }))).toMatchObject({ code: "NOT_FOUND" });
    expect(await reject(updateStaffLine({ requestId: r.id, lineId: other.cordon.id, userId: staff(), patch: { quantity: 2 } }))).toMatchObject({ code: "NOT_FOUND" });
    expect(await reject(addStaffLine(service("inconnue")))).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("commande sans ligne", () => {
  it("première ligne en position 0 ; retrait de la dernière ligne -> total 0", async () => {
    const r = await makeRequest(fx, { status: "SUBMITTED" });
    const { line } = await addStaffLine(service(r.id));
    expect(line.position).toBe(0);
    expect((await reload(r.id)).total).toBe(5000);
    await removeStaffLine({ requestId: r.id, lineId: line.id, userId: staff() });
    expect((await reload(r.id)).total).toBe(0);
  });
});

describe("règles de signe et de montant", () => {
  it("DISCOUNT à +100 et SERVICE à -100 -> VALIDATION (ajout et modification)", async () => {
    const { r, cordon } = await requestWithLines();
    expect(await reject(addStaffLine(service(r.id, { kind: "DISCOUNT", unitPrice: 100 })))).toMatchObject({ code: "VALIDATION", status: 400 });
    expect(await reject(addStaffLine(service(r.id, { unitPrice: -100 })))).toMatchObject({ code: "VALIDATION" });
    expect(await reject(updateStaffLine({ requestId: r.id, lineId: cordon.id, userId: staff(), patch: { unitPrice: -100 } }))).toMatchObject({ code: "VALIDATION" });
    const disc = await addStaffLine(service(r.id, { kind: "DISCOUNT", label: "Geste", unitPrice: -100 }));
    expect(disc.line.lineTotal).toBe(-100);
    expect(await reject(updateStaffLine({ requestId: r.id, lineId: disc.line.id, userId: staff(), patch: { unitPrice: 100 } }))).toMatchObject({ code: "VALIDATION" });
    expect(await activeLines(r.id)).toHaveLength(3);
  });

  it("entrée hors schéma -> VALIDATION (libellé vide, produit manquant)", async () => {
    const { r, cordon } = await requestWithLines();
    expect(await reject(addStaffLine(service(r.id, { label: "  " })))).toMatchObject({ code: "VALIDATION" });
    expect(await reject(addStaffLine(service(r.id, { kind: "PRODUCT" })))).toMatchObject({ code: "VALIDATION" });
    expect(await reject(updateStaffLine({ requestId: r.id, lineId: cordon.id, userId: staff(), patch: {} }))).toMatchObject({ code: "VALIDATION" });
  });

  it("montant de ligne ou total au-delà de 2 000 000 000 -> VALIDATION, rien d'écrit", async () => {
    const { r, cordon } = await requestWithLines();
    expect(await reject(addStaffLine(service(r.id, { quantity: 1_000_000, unitPrice: 5_000_000 })))).toMatchObject({ code: "VALIDATION" });
    expect(await reject(updateStaffLine({ requestId: r.id, lineId: cordon.id, userId: staff(), patch: { quantity: 1_000_000, unitPrice: 9_000_000 } }))).toMatchObject({ code: "VALIDATION" });
    // Deux lignes à 1 500 000 000 : chacune passe, le total non.
    await addStaffLine(service(r.id, { quantity: 1000, unitPrice: 1_500_000 }));
    expect(await reject(addStaffLine(service(r.id, { label: "Autre", quantity: 1000, unitPrice: 1_500_000 })))).toMatchObject({ code: "VALIDATION" });
    expect(await activeLines(r.id)).toHaveLength(3);
    expect((await reload(r.id)).total).toBe(6000 + 1_500_000_000);
  });

  it("statut verrouillé : ACCEPTED -> QUOTE_ACCEPTED, PAID/DRAFT -> REQUEST_LOCKED", async () => {
    for (const [status, code] of [["ACCEPTED", "QUOTE_ACCEPTED"], ["PAID", "REQUEST_LOCKED"], ["DRAFT", "REQUEST_LOCKED"]] as const) {
      const { r, cordon } = await requestWithLines(status);
      expect(await reject(addStaffLine(service(r.id))), status).toMatchObject({ code });
      expect(await reject(updateStaffLine({ requestId: r.id, lineId: cordon.id, userId: staff(), patch: { quantity: 2 } })), status).toMatchObject({ code });
      expect(await reject(removeStaffLine({ requestId: r.id, lineId: cordon.id, userId: staff() })), status).toMatchObject({ code });
    }
  });
});

describe("addStaffLine — produit", () => {
  it("PRODUCT sans choix : libellé et prix saisis font foi", async () => {
    const { r } = await requestWithLines();
    const res = await addStaffLine({
      requestId: r.id, userId: staff(),
      line: { kind: "PRODUCT", productId: fx.lanyard.id, label: "Cordon spécial", quantity: 2, unitPrice: 300 },
    });
    expect(res.line).toMatchObject({ productId: fx.lanyard.id, label: "Cordon spécial", unitPrice: 300, lineTotal: 600, addedBy: "STAFF" });
    expect(res.line.choices).toBeNull();
  });

  it("PRODUCT avec choix vides : normalisés, instantané enregistré", async () => {
    const { r } = await requestWithLines();
    const res = await addStaffLine({
      requestId: r.id, userId: staff(),
      line: { kind: "PRODUCT", productId: fx.lanyard.id, label: "Cordon", quantity: 2, unitPrice: 300, choices: [{ optionId: "x", valueIds: [] }] },
    }).then((v) => v, (e) => e as PrintRequestError);
    // Option inconnue (choix vide du type inconnu conservé) : refusée par validateChoices.
    expect(res).toMatchObject({ code: "INVALID_CHOICES" });
    const ok = await addStaffLine({
      requestId: r.id, userId: staff(),
      line: { kind: "PRODUCT", productId: fx.lanyard.id, label: "Cordon", quantity: 2, unitPrice: 300, choices: [] },
    });
    expect(ok.line.choices).toEqual([]);
    expect(ok.line.optionsSnapshot).toEqual([]);
  });

  it("produit inconnu, archivé ou non publié -> PRODUCT_UNAVAILABLE", async () => {
    const { r } = await requestWithLines();
    const line = { kind: "PRODUCT" as const, label: "x", quantity: 1, unitPrice: 1 };
    expect(await reject(addStaffLine({ requestId: r.id, userId: staff(), line: { ...line, productId: "inconnu" } }))).toMatchObject({ code: "PRODUCT_UNAVAILABLE", status: 400 });
    await prisma.printProduct.update({ where: { id: fx.lanyard.id }, data: { archived: true } });
    expect(await reject(addStaffLine({ requestId: r.id, userId: staff(), line: { ...line, productId: fx.lanyard.id } }))).toMatchObject({ code: "PRODUCT_UNAVAILABLE" });
    await prisma.printProduct.update({ where: { id: fx.lanyard.id }, data: { archived: false, published: false } });
    expect(await reject(addStaffLine({ requestId: r.id, userId: staff(), line: { ...line, productId: fx.lanyard.id } }))).toMatchObject({ code: "PRODUCT_UNAVAILABLE" });
  });

  it("choix invalide -> INVALID_CHOICES ; minimum de commande -> BELOW_MIN_QUANTITY ; fichier d'un autre évènement -> INVALID_FILE", async () => {
    const { r } = await requestWithLines();
    const line = { kind: "PRODUCT" as const, productId: fx.lanyard.id, label: "Cordon", quantity: 1, unitPrice: 10 };
    expect(await reject(addStaffLine({ requestId: r.id, userId: staff(), line: { ...line, choices: [{ optionId: "zzz", text: "x" }] } }))).toMatchObject({
      code: "INVALID_CHOICES", status: 400, details: { productId: fx.lanyard.id, code: "UNKNOWN_OPTION", optionId: "zzz" },
    });
    await prisma.printProduct.update({ where: { id: fx.lanyard.id }, data: { minQuantity: 10 } });
    expect(await reject(addStaffLine({ requestId: r.id, userId: staff(), line: { ...line, choices: [] } }))).toMatchObject({
      code: "BELOW_MIN_QUANTITY", details: { minQuantity: 10 },
    });
    await prisma.printProduct.update({ where: { id: fx.lanyard.id }, data: { minQuantity: 1 } });
    expect(await reject(addStaffLine({ requestId: r.id, userId: staff(), line: { ...line, choices: [{ optionId: "o", fileKey: "print-requests/autre/f.png" }] } }))).toMatchObject({
      code: "INVALID_CHOICES", details: { code: "INVALID_FILE", optionId: "o" },
    });
  });

  it("option du produit : choix valide stocké avec son instantané, prix saisi conservé", async () => {
    const { r } = await requestWithLines();
    const option = await prisma.printProductOption.create({
      data: {
        productId: fx.lanyard.id, name: "Couleur", type: "CHOICE", required: true, position: 0,
        values: { create: [{ label: "Bleu", position: 0 }] },
      },
      include: { values: true },
    });
    const res = await addStaffLine({
      requestId: r.id, userId: staff(),
      line: {
        kind: "PRODUCT", productId: fx.lanyard.id, label: "Cordon", quantity: 2, unitPrice: 123,
        choices: [{ optionId: option.id, valueIds: [option.values[0].id] }],
      },
    });
    expect(res.line.unitPrice).toBe(123);
    expect(res.line.choices).toEqual([{ optionId: option.id, valueIds: [option.values[0].id] }]);
    expect(res.line.optionsSnapshot).toHaveLength(1);
  });
});

describe("summarizeQuoteDiff", () => {
  const a = { id: "a", label: "Support", quantity: 3, unitPrice: 1500 };
  const b = { id: "b", label: "Cordon", quantity: 3, unitPrice: 500 };
  const c = { id: "c", label: "Livraison", quantity: 1, unitPrice: 5000 };

  it("première version : liste toutes les lignes et le total", () => {
    const text = summarizeQuoteDiff(null, [a, b], 1, 6000);
    expect(text).toContain("Devis v1 : 2 ligne(s)");
    expect(text).toContain("Ligne ajoutée : Support");
    expect(text).toContain("Ligne ajoutée : Cordon");
    expect(text).toContain(`Total : ${formatFcfa(6000)}`);
  });

  it("ajoutée, modifiée, retirée depuis la version précédente", () => {
    const text = summarizeQuoteDiff([a, b], [{ ...a, unitPrice: 1200 }, c], 2, 8600);
    expect(text).toContain("Ligne ajoutée : Livraison");
    expect(text).toContain("Ligne modifiée : Support (prix unitaire");
    expect(text).toContain("Ligne retirée : Cordon");
    expect(text).not.toContain("Ligne modifiée : Cordon");
    expect(text).toContain(`Total : ${formatFcfa(8600)}`);
  });

  it("changement d'intitulé seul compté comme modifié ; rien de changé -> mention explicite", () => {
    expect(summarizeQuoteDiff([a], [{ ...a, label: "Support bleu" }], 2, 4500)).toContain("Ligne modifiée : Support bleu");
    expect(summarizeQuoteDiff([a], [a], 2, 4500)).toContain("Aucune ligne modifiée.");
  });
});

describe("sendQuote : récapitulatif pour l'organisateur", () => {
  it("v1 puis v2 : message récapitulatif visible de l'organisateur avec les lignes changées entre les versions", async () => {
    const { r, support, cordon } = await requestWithLines();
    await sendQuote({ requestId: r.id, userId: staff() });
    await prisma.printRequest.update({ where: { id: r.id }, data: { status: "SUBMITTED" } });
    await updateStaffLine({ requestId: r.id, lineId: support.id, userId: staff(), patch: { unitPrice: 1200 } });
    await removeStaffLine({ requestId: r.id, lineId: cordon.id, userId: staff() });
    await addStaffLine(service(r.id));
    const sent = await sendQuote({ requestId: r.id, userId: staff() });
    const { listThread } = await import("@/lib/print-requests/thread");
    const visible = await listThread(r.id, "ORGANIZER");
    expect(visible.some((e) => e.eventType === "LINES_CHANGED")).toBe(false);
    const recaps = visible.filter((e) => e.kind === "MESSAGE");
    expect(recaps).toHaveLength(2);
    const v2 = recaps[1];
    expect(v2.side).toBe("STAFF");
    expect(v2.body).toContain("Devis v2 : modifications depuis la version précédente");
    expect(v2.body).toContain("Ligne ajoutée : ");
    expect(v2.body).toContain("Ligne modifiée : Support");
    expect(v2.body).toContain("Ligne retirée : Cordon");
    expect(v2.body).toContain(`Total : ${formatFcfa(sent.total)}`);
    const order = visible.map((e) => e.eventType ?? e.kind);
    expect(order.lastIndexOf("QUOTE_SENT")).toBeLessThan(order.lastIndexOf("MESSAGE"));
  });
});

describe("sendQuote : envoi antérieur sans instantané", () => {
  it("récapitulatif complet de la version, comme pour la première", async () => {
    const { r } = await requestWithLines();
    await prisma.printRequestMessage.create({
      data: { requestId: r.id, side: "STAFF", kind: "EVENT", eventType: "QUOTE_SENT", body: "Devis v1 envoyé", details: { version: 1, total: 100 } },
    });
    await prisma.printRequest.update({ where: { id: r.id }, data: { quoteVersion: 1 } });
    await sendQuote({ requestId: r.id, userId: staff() });
    const recap = (await thread(r.id)).find((m) => m.kind === "MESSAGE")!;
    expect(recap.body).toContain("Devis v2 : 2 ligne(s)");
  });
});

describe("sendQuote", () => {
  it("SUBMITTED -> QUOTED, quoteVersion 1, quotedAt, entrée « Devis v1 envoyé »", async () => {
    const { r, support } = await requestWithLines();
    await updateStaffLine({ requestId: r.id, lineId: support.id, userId: staff(), patch: { unitPrice: 1200 } });
    const sent = await sendQuote({ requestId: r.id, userId: staff() });
    expect(sent).toMatchObject({ status: "QUOTED", quoteVersion: 1, total: 5100 });
    expect(sent.quotedAt).not.toBeNull();
    const last = (await thread(r.id)).find((m) => m.eventType === "QUOTE_SENT")!;
    expect(last).toMatchObject({ eventType: "QUOTE_SENT", side: "STAFF", authorId: staff(), internal: false });
    expect(last.body).toBe(`Devis v1 envoyé : ${formatFcfa(5100)}`);
    expect(last.details).toMatchObject({ version: 1, total: 5100 });
    expect((last.details as { lines: unknown[] }).lines).toHaveLength(2);
  });

  it("sans ligne active -> EMPTY_QUOTE ; total négatif -> NEGATIVE_TOTAL ; rien n'est écrit", async () => {
    const empty = await makeRequest(fx, { status: "SUBMITTED" });
    expect(await reject(sendQuote({ requestId: empty.id, userId: staff() }))).toMatchObject({ code: "EMPTY_QUOTE", status: 400 });
    expect((await reload(empty.id)).status).toBe("SUBMITTED");
    const { r } = await requestWithLines();
    await addStaffLine(service(r.id, { kind: "DISCOUNT", label: "Remise", quantity: 1, unitPrice: -7000 }));
    expect(await reject(sendQuote({ requestId: r.id, userId: staff() }))).toMatchObject({ code: "NEGATIVE_TOTAL", status: 400 });
    const after = await reload(r.id);
    expect(after).toMatchObject({ status: "SUBMITTED", quoteVersion: 0, quotedAt: null });
  });

  it("exige une ligne de support de badge active : un accessoire seul, ou un badge retiré, est refusé", async () => {
    const { r, support } = await requestWithLines();
    await prisma.printQuoteLine.update({ where: { id: support.id }, data: { removedAt: new Date() } });
    expect(await reject(sendQuote({ requestId: r.id, userId: staff() }))).toMatchObject({
      code: "BADGE_PRODUCT_REQUIRED", status: 400,
    });
    const onlyService = await makeRequest(fx, { status: "SUBMITTED" });
    await addStaffLine(service(onlyService.id, { kind: "SERVICE", label: "Frais", quantity: 1, unitPrice: 1000 }));
    expect(await reject(sendQuote({ requestId: onlyService.id, userId: staff() }))).toMatchObject({ code: "BADGE_PRODUCT_REQUIRED" });
    expect((await reload(onlyService.id)).status).toBe("SUBMITTED");
  });

  it("exige un total strictement positif : 0 -> ZERO_TOTAL avec message français, rien n'est écrit", async () => {
    const { r } = await requestWithLines();
    await addStaffLine(service(r.id, { kind: "DISCOUNT", label: "Remise", quantity: 1, unitPrice: -6000 }));
    const err = await reject(sendQuote({ requestId: r.id, userId: staff() }));
    expect(err).toMatchObject({ code: "ZERO_TOTAL", status: 400 });
    expect(PRINT_REQUEST_ERROR_MESSAGES.ZERO_TOTAL).toBe("Le total du devis doit être supérieur à zéro.");
    expect(await reload(r.id)).toMatchObject({ status: "SUBMITTED", quoteVersion: 0, quotedAt: null });
  });

  it("total nul sans ligne de crédit : ZERO_TOTAL même si une ligne de crédit a été retirée ; total négatif -> NEGATIVE_TOTAL", async () => {
    const { r } = await requestWithLines();
    await prisma.orgPrintCredit.create({ data: { orgId: fx.org.id, kind: "EARNED", amount: 6000 } });
    await applyOrgCredit({ requestId: r.id, amount: 6000, userId: staff() });
    await prisma.printQuoteLine.updateMany({
      where: { requestId: r.id, usesOrgCredit: true },
      data: { removedAt: new Date() },
    });
    await prisma.printQuoteLine.create({
      data: { requestId: r.id, kind: "DISCOUNT", label: "Remise", quantity: 1, unitPrice: -6000, lineTotal: -6000, position: 9, addedBy: "STAFF" },
    });
    expect(await reject(sendQuote({ requestId: r.id, userId: staff() }))).toMatchObject({ code: "ZERO_TOTAL" });
    expect((await reload(r.id)).status).toBe("SUBMITTED");
  });

  it("total nul couvert par une ligne de crédit active : le devis part (QUOTED, total 0, entrée du fil)", async () => {
    const { r } = await requestWithLines();
    await prisma.orgPrintCredit.create({ data: { orgId: fx.org.id, kind: "EARNED", amount: 6000 } });
    await applyOrgCredit({ requestId: r.id, amount: 6000, userId: staff() });
    const out = await sendQuote({ requestId: r.id, userId: staff() });
    expect(out).toMatchObject({ status: "QUOTED", total: 0, quoteVersion: 1 });
    expect((await thread(r.id)).map((e) => e.eventType)).toContain("QUOTE_SENT");
  });

  it("depuis un autre statut -> INVALID_TRANSITION ; commande inconnue -> 404", async () => {
    const { r } = await requestWithLines("QUOTED");
    expect(await reject(sendQuote({ requestId: r.id, userId: staff() }))).toMatchObject({ code: "INVALID_TRANSITION" });
    expect(await reject(sendQuote({ requestId: "inconnue", userId: staff() }))).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("réouverture (critère 3)", () => {
  it("devis v2 accepté : modification -> QUOTE_ACCEPTED ; réouverture -> SUBMITTED, acceptation effacée ; v3", async () => {
    const { r, cordon } = await requestWithLines("ACCEPTED", {
      quoteVersion: 2, acceptedVersion: 2, acceptedTotal: 6000, acceptedAt: new Date(), acceptedById: fx.owner.id,
    });
    expect(await reject(updateStaffLine({ requestId: r.id, lineId: cordon.id, userId: staff(), patch: { quantity: 4 } }))).toMatchObject({ code: "QUOTE_ACCEPTED" });
    const reopened = await reopenQuote({ requestId: r.id, userId: staff() });
    expect(reopened).toMatchObject({ status: "SUBMITTED", acceptedVersion: null, acceptedTotal: null, acceptedAt: null, acceptedById: null });
    const last = (await thread(r.id)).at(-1)!;
    expect(last).toMatchObject({ eventType: "QUOTE_REOPENED", side: "STAFF" });
    expect(last.body).toBe("Devis v2 rouvert : l'acceptation est annulée");
    await updateStaffLine({ requestId: r.id, lineId: cordon.id, userId: staff(), patch: { quantity: 4 } });
    const v3 = await sendQuote({ requestId: r.id, userId: staff() });
    expect(v3).toMatchObject({ status: "QUOTED", quoteVersion: 3, total: 4500 + 2000 });
  });

  it("paiement en cours -> PAYMENT_IN_PROGRESS, commande inchangée ; sonde appelée sous verrou", async () => {
    const { r } = await requestWithLines("ACCEPTED", { quoteVersion: 1, acceptedVersion: 1, acceptedTotal: 6000 });
    vi.spyOn(paymentProbe, "isPaymentInProgress").mockResolvedValue(true);
    expect(await reject(reopenQuote({ requestId: r.id, userId: staff() }))).toMatchObject({ code: "PAYMENT_IN_PROGRESS", status: 409 });
    expect((await reload(r.id)).status).toBe("ACCEPTED");
  });

  it("hors ACCEPTED -> INVALID_TRANSITION ; inconnue -> 404", async () => {
    const { r } = await requestWithLines("QUOTED");
    expect(await reject(reopenQuote({ requestId: r.id, userId: staff() }))).toMatchObject({ code: "INVALID_TRANSITION" });
    expect(await reject(reopenQuote({ requestId: "inconnue", userId: staff() }))).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("rejectRequest", () => {
  it("motif « ok » -> VALIDATION ; motif valide -> REJECTED avec entrée", async () => {
    const { r } = await requestWithLines("QUOTED");
    expect(await reject(rejectRequest({ requestId: r.id, userId: staff(), reason: "ok" }))).toMatchObject({ code: "VALIDATION" });
    expect(await reject(rejectRequest({ requestId: r.id, userId: staff(), reason: "a".repeat(1001) }))).toMatchObject({ code: "VALIDATION" });
    expect((await reload(r.id)).status).toBe("QUOTED");
    const res = await rejectRequest({ requestId: r.id, userId: staff(), reason: "  Format non pris en charge\u0000 " });
    expect(res.status).toBe("REJECTED");
    const last = (await thread(r.id)).at(-1)!;
    expect(last).toMatchObject({ eventType: "REJECTED", side: "STAFF", body: "Commande refusée : Format non pris en charge" });
    expect(last.details).toEqual({ reason: "Format non pris en charge" });
  });

  it("depuis PAID -> INVALID_TRANSITION ; inconnue -> 404", async () => {
    const { r } = await requestWithLines("PAID");
    expect(await reject(rejectRequest({ requestId: r.id, userId: staff(), reason: "Motif valable" }))).toMatchObject({ code: "INVALID_TRANSITION" });
    expect(await reject(rejectRequest({ requestId: "inconnue", userId: staff(), reason: "Motif valable" }))).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("advanceStatus", () => {
  it("PAID -> IN_PRODUCTION -> READY -> COMPLETED : trois entrées STATUS_CHANGED, completedAt", async () => {
    const { r } = await requestWithLines("PAID");
    expect((await advanceStatus({ requestId: r.id, userId: staff(), to: "IN_PRODUCTION" })).status).toBe("IN_PRODUCTION");
    expect((await advanceStatus({ requestId: r.id, userId: staff(), to: "READY" })).status).toBe("READY");
    const done = await advanceStatus({ requestId: r.id, userId: staff(), to: "COMPLETED" });
    expect(done.status).toBe("COMPLETED");
    expect(done.completedAt).not.toBeNull();
    const entries = (await thread(r.id)).filter((m) => m.eventType === "STATUS_CHANGED");
    expect(entries.map((m) => m.body)).toEqual([
      "Statut : Payée → En production",
      "Statut : En production → Prête",
      "Statut : Prête → Terminée",
    ]);
    expect(entries[0]).toMatchObject({ side: "STAFF", authorId: staff(), details: { from: "PAID", to: "IN_PRODUCTION" } });
  });

  it("saut PAID -> COMPLETED -> INVALID_TRANSITION ; statut inconnu -> VALIDATION ; inconnue -> 404", async () => {
    const { r } = await requestWithLines("PAID");
    expect(await reject(advanceStatus({ requestId: r.id, userId: staff(), to: "COMPLETED" }))).toMatchObject({ code: "INVALID_TRANSITION", status: 409 });
    expect((await reload(r.id)).status).toBe("PAID");
    expect(await reject(advanceStatus({ requestId: r.id, userId: staff(), to: "PAID" as never }))).toMatchObject({ code: "VALIDATION" });
    expect(await reject(advanceStatus({ requestId: "inconnue", userId: staff(), to: "READY" }))).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("ligne de crédit d'impression : modifiable par applyOrgCredit seulement", () => {
  async function withCreditLine() {
    const { r } = await requestWithLines("SUBMITTED");
    const credit = await prisma.printQuoteLine.create({
      data: {
        requestId: r.id, kind: "DISCOUNT", label: "Crédit d'impression", quantity: 1, unitPrice: -1000,
        lineTotal: -1000, position: 2, addedBy: "STAFF", usesOrgCredit: true,
      },
    });
    return { r, credit };
  }

  it("updateStaffLine : CREDIT_LINE_LOCKED, rien d'écrit", async () => {
    const { r, credit } = await withCreditLine();
    const err = await reject(updateStaffLine({ requestId: r.id, lineId: credit.id, userId: staff(), patch: { unitPrice: -500 } }));
    expect(err).toMatchObject({ code: "CREDIT_LINE_LOCKED", status: 409 });
    expect((await prisma.printQuoteLine.findUniqueOrThrow({ where: { id: credit.id } })).unitPrice).toBe(-1000);
    expect(await thread(r.id)).toHaveLength(0);
  });

  it("removeStaffLine : CREDIT_LINE_LOCKED, la ligne reste active", async () => {
    const { r, credit } = await withCreditLine();
    const err = await reject(removeStaffLine({ requestId: r.id, lineId: credit.id, userId: staff() }));
    expect(err).toMatchObject({ code: "CREDIT_LINE_LOCKED", status: 409 });
    expect((await prisma.printQuoteLine.findUniqueOrThrow({ where: { id: credit.id } })).removedAt).toBeNull();
  });
});

describe("markPaidManually", () => {
  const accepted = () => requestWithLines("ACCEPTED", { quoteVersion: 1, acceptedVersion: 1, acceptedTotal: 6000 });

  it("STAFF_ADMIN sur ACCEPTED -> PAID avec motif nettoyé, entrée PAYMENT_RECEIVED", async () => {
    const { r } = await accepted();
    const res = await markPaidManually({ requestId: r.id, userId: staff(), reason: "  Virement reçu le 3  " });
    expect(res).toMatchObject({ status: "PAID", paidPaymentId: null });
    expect(res.paidAt).not.toBeNull();
    const last = (await thread(r.id)).at(-1)!;
    expect(last).toMatchObject({ eventType: "PAYMENT_RECEIVED", side: "STAFF", authorId: staff() });
    expect(last.details).toEqual({ amount: 6000, reason: "Virement reçu le 3" });
  });

  it("SUPER_ADMIN accepté ; STAFF_SUPPORT, organisateur et inconnu refusés", async () => {
    const superAdmin = await prisma.user.create({
      data: { email: `sa-${Date.now()}@x.test`, password: "x", name: "sa", isStaff: true, staffRole: "SUPER_ADMIN" },
    });
    const a = await accepted();
    expect((await markPaidManually({ requestId: a.r.id, userId: superAdmin.id, reason: "Espèces" })).status).toBe("PAID");
    const b = await accepted();
    const printer = await makeStaff("STAFF_PRINTER");
    for (const userId of [fx.staffSupport.id, fx.staffObserver.id, printer.id, fx.owner.id, "inconnu"]) {
      expect(await reject(markPaidManually({ requestId: b.r.id, userId, reason: "Espèces" })), userId).toMatchObject({ code: "STAFF_FORBIDDEN", status: 403 });
    }
    expect((await reload(b.r.id)).status).toBe("ACCEPTED");
  });

  it("motif trop court, trop long -> VALIDATION", async () => {
    const { r } = await accepted();
    expect(await reject(markPaidManually({ requestId: r.id, userId: staff(), reason: " ab " }))).toMatchObject({ code: "VALIDATION" });
    expect(await reject(markPaidManually({ requestId: r.id, userId: staff(), reason: "a".repeat(501) }))).toMatchObject({ code: "VALIDATION" });
    expect((await reload(r.id)).status).toBe("ACCEPTED");
  });

  it("sur QUOTED -> INVALID_TRANSITION", async () => {
    const { r } = await requestWithLines("QUOTED");
    expect(await reject(markPaidManually({ requestId: r.id, userId: staff(), reason: "Virement" }))).toMatchObject({ code: "INVALID_TRANSITION", status: 409 });
    expect(await reject(markPaidManually({ requestId: "inconnue", userId: staff(), reason: "Virement" }))).toMatchObject({ code: "NOT_FOUND" });
  });

  it("paiement en cours (sonde) -> PAYMENT_IN_PROGRESS, commande inchangée", async () => {
    const { r } = await accepted();
    vi.spyOn(paymentProbe, "isPaymentInProgress").mockResolvedValue(true);
    expect(await reject(markPaidManually({ requestId: r.id, userId: staff(), reason: "Virement" }))).toMatchObject({ code: "PAYMENT_IN_PROGRESS", status: 409 });
    expect((await reload(r.id)).status).toBe("ACCEPTED");
  });

  it("la sonde est appelée alors que la ligne de la commande est verrouillée", async () => {
    const { r } = await accepted();
    let blocked: boolean | null = null;
    vi.spyOn(paymentProbe, "isPaymentInProgress").mockImplementation(async () => {
      // Une autre connexion ne peut pas verrouiller la ligne pendant la sonde.
      blocked = await prisma
        .$transaction(
          async (tx) => {
            await tx.$executeRaw`SET SESSION innodb_lock_wait_timeout = 1`;
            await tx.$queryRaw`SELECT id FROM \`PrintRequest\` WHERE id = ${r.id} FOR UPDATE`;
            return false;
          },
          { timeout: 5000 },
        )
        .catch(() => true);
      return false;
    });
    await markPaidManually({ requestId: r.id, userId: staff(), reason: "Virement" });
    expect(blocked).toBe(true);
  });
});
