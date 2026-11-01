import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { PrintRequestError } from "@/lib/print-requests/errors";
import { submitRequest } from "@/lib/print-requests/lifecycle";
import {
  OnsiteError,
  assertOnsiteCanAdvance,
  getOnsiteEligibility,
  onsiteErrorResponse,
  onsiteOrPrintErrorResponse,
  onsiteTemplateStatus,
  prepareOnsiteSubmission,
} from "@/lib/print-requests/onsite";
import { seedPrintFixture, makeRequest, type PrintFixture } from "./helpers/print-requests";

let fx: PrintFixture;
beforeEach(async () => {
  fx = await seedPrintFixture();
  // Le singleton survit aux tests : réglages remis à zéro.
  await prisma.platformSettings.update({
    where: { id: "singleton" },
    data: { onsitePrintTemplateIds: [], onsiteDefaultMarginPercent: 10 },
  });
});

const setList = (ids: string[], margin?: number) =>
  prisma.platformSettings.update({
    where: { id: "singleton" },
    data: { onsitePrintTemplateIds: ids, ...(margin !== undefined ? { onsiteDefaultMarginPercent: margin } : {}) },
  });
const reject = async (p: Promise<unknown>) => p.then(() => null, (e) => e as Error);
const base = (requestId: string) => ({ requestId, eventId: fx.event.id, userId: fx.owner.id });

async function onsiteDraft(over: Parameters<typeof makeRequest>[1] = {}) {
  const r = await makeRequest(fx, {
    type: "ONSITE", status: "DRAFT", estimatedQuantity: 50, onsiteLocation: "Hall A",
    onsiteContactName: "Moussa", onsiteContactPhone: "91000000", total: 1500,
    onsiteSchedule: [{ date: "2026-11-02", from: "09:00", to: "18:00" }], ...over,
  });
  await prisma.printQuoteLine.create({
    data: {
      requestId: r.id, kind: "PRODUCT", productId: fx.badgeProduct.id, label: "Support badge PVC",
      quantity: 50, unitPrice: 1500, lineTotal: 75000, position: 0, addedBy: "ORGANIZER",
    },
  });
  return r;
}

describe("getOnsiteEligibility", () => {
  it("éligible : template de l'évènement dans la liste", async () => {
    await setList([fx.template.id]);
    expect(await getOnsiteEligibility(fx.event.id)).toEqual({ eligible: true, templateId: fx.template.id });
  });

  it("éligible par héritage : l'évènement hérite du template de l'organisation, coché", async () => {
    await prisma.event.update({ where: { id: fx.event.id }, data: { badgeTemplateId: null } });
    await prisma.organization.update({ where: { id: fx.org.id }, data: { badgeTemplateId: fx.template.id } });
    await setList([fx.template.id]);
    expect(await getOnsiteEligibility(fx.event.id)).toEqual({ eligible: true, templateId: fx.template.id });
  });

  it("non éligible : template hors liste", async () => {
    await setList(["autre"]);
    expect(await getOnsiteEligibility(fx.event.id)).toEqual({ eligible: false, templateId: fx.template.id });
  });

  it("id inconnu : repli sur la famille par défaut, comparé sur l'id de la copie", async () => {
    const fallback = await prisma.installedBadgeTemplate.create({
      data: {
        family: "default", version: 9000 + Math.floor(Math.random() * 900), label: "Défaut", description: "",
        pages: 1, pageWidthPx: 100, pageHeightPx: 100, layout: { variables: [] }, bindings: {},
        assetPrefix: "badge-templates/default/", formatVersion: 3, installedById: "u1",
      },
    });
    await prisma.event.update({ where: { id: fx.event.id }, data: { badgeTemplateId: "inconnu" } });
    await setList(["inconnu"]);
    const out = await getOnsiteEligibility(fx.event.id);
    expect(out.eligible).toBe(false);
    expect(out.templateId).toBe(fallback.id);
    await prisma.installedBadgeTemplate.delete({ where: { id: fallback.id } });
  });

  it("évènement inconnu -> NOT_FOUND ; aucun template lisible -> VALIDATION", async () => {
    expect(((await reject(getOnsiteEligibility("nope"))) as PrintRequestError).code).toBe("NOT_FOUND");
    await prisma.event.update({ where: { id: fx.event.id }, data: { badgeTemplateId: "inconnu" } });
    await prisma.installedBadgeTemplate.deleteMany({ where: { family: "default" } });
    await prisma.installedBadgeTemplate.delete({ where: { id: fx.template.id } }).catch(() => {});
    expect(((await reject(getOnsiteEligibility(fx.event.id))) as PrintRequestError).code).toBe("VALIDATION");
  });
});

describe("prepareOnsiteSubmission", () => {
  it("ADVANCE -> null", async () => {
    await prisma.$transaction(async (tx) => {
      expect(await prepareOnsiteSubmission(tx, { eventId: fx.event.id, type: "ADVANCE" })).toBeNull();
    });
  });

  it("évènement inconnu -> NOT_FOUND", async () => {
    const err = await reject(prisma.$transaction((tx) => prepareOnsiteSubmission(tx, { eventId: "nope", type: "ONSITE" })));
    expect((err as PrintRequestError).code).toBe("NOT_FOUND");
  });

  it("template introuvable -> ONSITE_TEMPLATE_UNSUITABLE", async () => {
    await prisma.event.update({ where: { id: fx.event.id }, data: { badgeTemplateId: "inconnu" } });
    await prisma.installedBadgeTemplate.deleteMany({ where: { family: "default" } });
    const err = await reject(prisma.$transaction((tx) => prepareOnsiteSubmission(tx, { eventId: fx.event.id, type: "ONSITE" })));
    expect((err as OnsiteError).code).toBe("ONSITE_TEMPLATE_UNSUITABLE");
  });
});

describe("envoi d'une demande sur place", () => {
  it("template hors liste : 409 ONSITE_TEMPLATE_UNSUITABLE, la demande reste DRAFT", async () => {
    await setList([]);
    const r = await onsiteDraft();
    const err = (await reject(submitRequest(base(r.id)))) as OnsiteError;
    expect(err).toBeInstanceOf(OnsiteError);
    expect([err.code, err.httpStatus]).toEqual(["ONSITE_TEMPLATE_UNSUITABLE", 409]);
    const after = await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } });
    expect(after.status).toBe("DRAFT");
    expect(after.marginPercent).toBeNull();
  });

  it("ONSITE : marginPercent = 10 ; passer la marge par défaut à 15 ne change pas la demande envoyée", async () => {
    await setList([fx.template.id]);
    const r = await onsiteDraft();
    const out = await submitRequest(base(r.id));
    expect(out.status).toBe("SUBMITTED");
    expect(out.marginPercent).toBe(10);
    await setList([fx.template.id], 15);
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).marginPercent).toBe(10);
    const next = await onsiteDraft();
    expect((await submitRequest(base(next.id))).marginPercent).toBe(15);
  });

  it("ADVANCE : marginPercent reste null", async () => {
    const r = await makeRequest(fx, { status: "DRAFT", delivery: "PICKUP", total: 4500 });
    await prisma.printQuoteLine.create({
      data: {
        requestId: r.id, kind: "PRODUCT", productId: fx.badgeProduct.id, label: "Support", quantity: 3,
        unitPrice: 1500, lineTotal: 4500, position: 0, addedBy: "ORGANIZER",
      },
    });
    await prisma.printRequestItem.create({ data: { requestId: r.id, registrationId: fx.approved[0].id, position: 0 } });
    expect((await submitRequest(base(r.id))).marginPercent).toBeNull();
  });
});

describe("traduction des erreurs", () => {
  it("OnsiteError -> { error, code, message, ...details }", async () => {
    const res = onsiteErrorResponse(new OnsiteError("CAP_REACHED", 409, { cap: 11 }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      cap: 11, error: "CAP_REACHED", code: "CAP_REACHED",
      message: "Le plafond d'impression de cette demande est atteint.",
    });
  });

  it("onsiteOrPrintErrorResponse : les deux familles, le reste est relancé", async () => {
    expect((onsiteOrPrintErrorResponse(new OnsiteError("NOT_ONSITE", 409))).status).toBe(409);
    expect((onsiteOrPrintErrorResponse(new PrintRequestError("NOT_FOUND", 404))).status).toBe(404);
    expect(() => onsiteOrPrintErrorResponse(new Error("boom"))).toThrow("boom");
  });
});

describe("onsiteTemplateStatus / assertOnsiteCanAdvance", () => {
  const onsite = (over: Partial<Parameters<typeof onsiteTemplateStatus>[0]> = {}) => ({
    type: "ONSITE" as const, parentRequestId: null, badgeTemplateId: fx.template.id, ...over,
  });

  it("OK : la copie du template figure dans la liste", async () => {
    await setList([fx.template.id]);
    expect(await onsiteTemplateStatus(onsite())).toBe("OK");
    await expect(assertOnsiteCanAdvance(onsite())).resolves.toBeUndefined();
  });

  it("NOT_APPLICABLE : demande en amont, demande complémentaire, brouillon sans copie", async () => {
    await setList([]);
    expect(await onsiteTemplateStatus(onsite({ type: "ADVANCE" }))).toBe("NOT_APPLICABLE");
    expect(await onsiteTemplateStatus(onsite({ parentRequestId: "parent" }))).toBe("NOT_APPLICABLE");
    expect(await onsiteTemplateStatus(onsite({ badgeTemplateId: null }))).toBe("NOT_APPLICABLE");
    await expect(assertOnsiteCanAdvance(onsite({ type: "ADVANCE" }))).resolves.toBeUndefined();
  });

  it("UNSUITABLE après retrait du template de la liste ; l'avancement est refusé en 409", async () => {
    await setList([fx.template.id]);
    expect(await onsiteTemplateStatus(onsite())).toBe("OK");
    await setList([]);
    expect(await onsiteTemplateStatus(onsite())).toBe("UNSUITABLE");
    const err = (await reject(assertOnsiteCanAdvance(onsite()))) as OnsiteError;
    expect([err.code, err.httpStatus]).toEqual(["ONSITE_TEMPLATE_UNSUITABLE", 409]);
  });
});
