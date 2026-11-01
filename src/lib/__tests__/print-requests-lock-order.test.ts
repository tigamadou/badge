import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { lockEventRow } from "@/lib/print-requests/content";
import { cancelRequest } from "@/lib/print-requests/lifecycle";
import { advanceStatus, reopenQuote } from "@/lib/print-requests/quote";
import { recordOnsitePrint } from "@/lib/print-requests/onsite-station";
import { pinLockedEventTemplates } from "@/lib/print-requests/template-lock";
import { seedPrintFixture, makeRequest, type PrintFixture } from "./helpers/print-requests";

// Ordre des verrous : Event puis PrintRequest partout. Une transition qui libère l'épinglage
// d'un template (COMPLETE, CANCEL depuis ACCEPTED, REOPEN) écrit la ligne Event ; elle ne doit pas
// s'interbloquer avec un changement de template d'organisation qui prend l'Event en premier.

const ITERATIONS = 5;
let fx: PrintFixture;

const copy = () => ({
  badgeTemplateId: fx.template.id,
  badgeWidthPx: fx.template.pageWidthPx,
  badgeHeightPx: fx.template.pageHeightPx,
  badgePages: fx.template.pages,
});

// Changement de template d'organisation : verrous des évènements, épinglage, puis écriture.
function orgTemplateChange() {
  return prisma.$transaction(async (tx) => {
    await lockEventRow(tx, fx.event.id);
    await pinLockedEventTemplates({ orgId: fx.org.id }, tx);
    await tx.organization.update({ where: { id: fx.org.id }, data: { badgeTemplateId: null } });
  });
}

async function pinned(status: "READY" | "ACCEPTED") {
  await prisma.event.update({ where: { id: fx.event.id }, data: { badgeTemplateId: fx.template.id } });
  return makeRequest(fx, { status, templatePinned: true, ...copy() });
}

const state = async (id: string) => ({
  request: await prisma.printRequest.findUniqueOrThrow({ where: { id } }),
  event: await prisma.event.findUniqueOrThrow({ where: { id: fx.event.id } }),
});

beforeEach(async () => {
  fx = await seedPrintFixture();
});

describe("ordre des verrous Event puis PrintRequest", () => {
  it("COMPLETE d'une demande READY épinglée face à un changement de template", async () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const r = await pinned("READY");
      const res = await Promise.allSettled([
        advanceStatus({ requestId: r.id, userId: fx.owner.id, to: "COMPLETED" }),
        orgTemplateChange(),
      ]);
      expect(res.map((x) => x.status)).toEqual(["fulfilled", "fulfilled"]);
      const s = await state(r.id);
      expect(s.request.status).toBe("COMPLETED");
      expect(s.request.templatePinned).toBe(false);
      expect(s.event.badgeTemplateId).toBeNull();
    }
  });

  it("CANCEL d'une demande ACCEPTED épinglée face à un changement de template", async () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const r = await pinned("ACCEPTED");
      const res = await Promise.allSettled([
        cancelRequest({ requestId: r.id, eventId: fx.event.id, userId: fx.owner.id }),
        orgTemplateChange(),
      ]);
      expect(res.map((x) => x.status)).toEqual(["fulfilled", "fulfilled"]);
      const s = await state(r.id);
      expect(s.request.status).toBe("CANCELLED");
      expect(s.request.templatePinned).toBe(false);
      expect(s.event.badgeTemplateId).toBeNull();
    }
  });

  it("REOPEN d'une demande ACCEPTED épinglée face à un changement de template", async () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const r = await pinned("ACCEPTED");
      const res = await Promise.allSettled([
        reopenQuote({ requestId: r.id, userId: fx.owner.id }),
        orgTemplateChange(),
      ]);
      expect(res.map((x) => x.status)).toEqual(["fulfilled", "fulfilled"]);
      const s = await state(r.id);
      expect(s.request.status).toBe("SUBMITTED");
      expect(s.request.templatePinned).toBe(false);
      expect(s.event.badgeTemplateId).toBeNull();
      await prisma.printRequest.update({ where: { id: r.id }, data: { status: "CANCELLED" } });
    }
  });

  it("impression sur place face à un changement de template : pas d'interblocage", async () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const r = await makeRequest(fx, { type: "ONSITE", status: "IN_PRODUCTION", estimatedQuantity: 10, marginPercent: 10 });
      const reg = fx.approved[i % fx.approved.length];
      await prisma.registration.update({ where: { id: reg.id }, data: { badgePrinted: false, badgePrintedAt: null } });
      const res = await Promise.allSettled([
        recordOnsitePrint({ requestId: r.id, registrationId: reg.id, userId: fx.owner.id, confirmReprint: false }),
        orgTemplateChange(),
      ]);
      expect(res.map((x) => x.status)).toEqual(["fulfilled", "fulfilled"]);
      await prisma.printRequest.update({ where: { id: r.id }, data: { status: "CANCELLED" } });
    }
  });
});
