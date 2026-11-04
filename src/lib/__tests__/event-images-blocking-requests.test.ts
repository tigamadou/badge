import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { EventImagesNoncompliantError } from "@/lib/event-image-compliance";
import { submitRequest } from "@/lib/print-requests/lifecycle";
import { recordOnsitePrint } from "@/lib/print-requests/onsite-station";
import { NONCOMPLIANT_LOGO_MESSAGE, breakEventLogo } from "@/test/factories-2a";
import { makeRequest, seedPrintFixture, type PrintFixture } from "./helpers/print-requests";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
// Les gardes d'abonnement sont couverts ailleurs : l'organisation est considérée active.
vi.mock("@/lib/subscription-access", async () => {
  const { DEFAULT_RIGHTS } = await import("@/lib/subscription-rights");
  return {
    loadOrgAccess: vi.fn(async () => ({
      active: true,
      maxEvents: null,
      maxParticipantsPerEvent: null,
      rights: DEFAULT_RIGHTS,
    })),
  };
});
vi.mock("@/lib/mail", () => ({ sendBadgePrintedNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notifications/triggers", () => ({
  notifyBadgePrinted: vi.fn().mockResolvedValue(undefined),
  notifyPrintRequestSubmitted: vi.fn().mockResolvedValue(undefined),
  notifyPrintRequestStatusChanged: vi.fn().mockResolvedValue(undefined),
}));
import { getServerSession } from "next-auth";
import { notifyPrintRequestSubmitted } from "@/lib/notifications/triggers";

let fx: PrintFixture;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockReset();
  fx = await seedPrintFixture();
  await prisma.platformSettings.update({
    where: { id: "singleton" },
    data: { onsitePrintTemplateIds: [], onsiteDefaultMarginPercent: 10 },
  });
});

const badgeLine = (requestId: string, quantity = 3) =>
  prisma.printQuoteLine.create({
    data: {
      requestId, kind: "PRODUCT", productId: fx.badgeProduct.id, label: "Support badge PVC", quantity,
      unitPrice: 1500, lineTotal: quantity * 1500, position: 0, addedBy: "ORGANIZER",
    },
  });

async function advanceDraft() {
  const r = await makeRequest(fx, { status: "DRAFT", delivery: "PICKUP", total: 4500 });
  await badgeLine(r.id);
  for (const [position, reg] of fx.approved.entries()) {
    await prisma.printRequestItem.create({ data: { requestId: r.id, registrationId: reg.id, position } });
  }
  return r;
}

async function onsiteDraft() {
  const r = await makeRequest(fx, {
    type: "ONSITE", status: "DRAFT", estimatedQuantity: 50, onsiteLocation: "Hall A",
    onsiteContactName: "Moussa", onsiteContactPhone: "91000000", total: 1500,
    onsiteSchedule: [{ date: "2026-11-02", from: "09:00", to: "18:00" }],
  });
  await badgeLine(r.id, 50);
  return r;
}

async function onsiteInProduction() {
  const r = await makeRequest(fx, {
    type: "ONSITE", status: "IN_PRODUCTION", estimatedQuantity: 10, marginPercent: 10,
  });
  await badgeLine(r.id, 10);
  return r;
}

const input = (requestId: string, registrationId: string) => ({
  requestId, registrationId, userId: fx.owner.id, confirmReprint: false,
});

describe("submitRequest sur un évènement non conforme", () => {
  it("ADVANCE : refusée, la commande reste DRAFT, aucune entrée de fil ni notification", async () => {
    const r = await advanceDraft();
    await breakEventLogo(fx.event.id, fx.staffAdmin.id);
    await expect(
      submitRequest({ requestId: r.id, eventId: fx.event.id, userId: fx.owner.id }),
    ).rejects.toBeInstanceOf(EventImagesNoncompliantError);
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("DRAFT");
    expect(await prisma.printRequestMessage.count({ where: { requestId: r.id } })).toBe(0);
    expect(notifyPrintRequestSubmitted).not.toHaveBeenCalled();
  });

  it("ONSITE : refusée, la commande reste DRAFT", async () => {
    const r = await onsiteDraft();
    await breakEventLogo(fx.event.id, fx.staffAdmin.id);
    await expect(
      submitRequest({ requestId: r.id, eventId: fx.event.id, userId: fx.owner.id }),
    ).rejects.toBeInstanceOf(EventImagesNoncompliantError);
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("DRAFT");
  });

  it("route submit : 422 EVENT_IMAGES_NONCOMPLIANT", async () => {
    const r = await advanceDraft();
    await breakEventLogo(fx.event.id, fx.staffAdmin.id);
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: fx.eventAdmin.id, email: fx.eventAdmin.email, name: fx.eventAdmin.name, isStaff: false },
    } as never);
    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/submit/route");
    const res = await POST(
      new NextRequest(`http://localhost/api/org/${fx.org.id}/events/${fx.event.id}/print-requests/${r.id}/submit`, {
        method: "POST",
      }),
      { params: Promise.resolve({ orgId: fx.org.id, eventId: fx.event.id, requestId: r.id }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("EVENT_IMAGES_NONCOMPLIANT");
    expect(body.message).toBe(NONCOMPLIANT_LOGO_MESSAGE);
  });

  it("une commande déjà envoyée avant le changement n'est pas remise en cause (autres transitions)", async () => {
    const r = await advanceDraft();
    await submitRequest({ requestId: r.id, eventId: fx.event.id, userId: fx.owner.id });
    await breakEventLogo(fx.event.id, fx.staffAdmin.id);
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("SUBMITTED");
  });
});

describe("recordOnsitePrint sur un évènement non conforme", () => {
  it("refusée : aucune ligne d'impression, badgePrinted inchangé", async () => {
    const r = await onsiteInProduction();
    await breakEventLogo(fx.event.id, fx.staffAdmin.id);
    const reg = fx.approved[0];
    await expect(recordOnsitePrint(input(r.id, reg.id))).rejects.toBeInstanceOf(EventImagesNoncompliantError);
    expect(await prisma.printRequestPrint.count({ where: { requestId: r.id } })).toBe(0);
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } })).badgePrinted).toBe(false);
  });

  it("conforme : l'impression est enregistrée", async () => {
    const r = await onsiteInProduction();
    const { print } = await recordOnsitePrint(input(r.id, fx.approved[0].id));
    expect(print.requestId).toBe(r.id);
  });

  it("commande inconnue : l'erreur habituelle, sans passer par le garde", async () => {
    await expect(recordOnsitePrint(input("inconnue", fx.approved[0].id))).rejects.not.toBeInstanceOf(
      EventImagesNoncompliantError,
    );
  });

  it("route onsite/print : 422", async () => {
    const r = await onsiteInProduction();
    await breakEventLogo(fx.event.id, fx.staffAdmin.id);
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: fx.staffSupport.id, email: fx.staffSupport.email, name: fx.staffSupport.name, isStaff: true },
    } as never);
    const { POST } = await import("@/app/api/platform/print/requests/[requestId]/onsite/print/route");
    const res = await POST(
      new NextRequest(`http://localhost/api/platform/print/requests/${r.id}/onsite/print`, {
        method: "POST",
        body: JSON.stringify({ registrationId: fx.approved[0].id }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ requestId: r.id }) },
    );
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("EVENT_IMAGES_NONCOMPLIANT");
  });
});
