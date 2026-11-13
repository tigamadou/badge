import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createBadgeFixtures } from "@/lib/badge-templates/__tests__/badge-fixtures";
import { loadBadgeRegistration, renderBadgeHtml, renderBadgePdf } from "@/lib/badge-templates/render-badge";
import { EventImagesNoncompliantError } from "@/lib/event-image-compliance";
import { createGeneration, createZipExport } from "@/lib/print-sheets/generations";
import { defaultRunDeps, runGeneration } from "@/lib/print-sheets/run-generation";
import { fakeExporter } from "@/lib/__tests__/helpers/fake-exporter";
import { makeRequest, seedPrintFixture } from "@/lib/__tests__/helpers/print-requests";
import { seedFactories, makePrintLayout, makeStaff } from "@/test/factories";
import {
  NONCOMPLIANT_LOGO_MESSAGE,
  breakEventLogo,
  makeFramedTemplate,
  makePng,
  putTestImage,
} from "@/test/factories-2a";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

seedFactories(2206);

// Le faux exporteur est un singleton : une trace laissée par un autre fichier ne doit pas fausser « aucun rendu ».
beforeEach(() => {
  fakeExporter.reset();
});

async function brokenFixtures() {
  const fx = await createBadgeFixtures();
  const reg = await fx.addRegistration();
  await breakEventLogo(fx.event.id, fx.admin.id);
  return { ...fx, reg };
}

describe("rendu d'un badge", () => {
  it("renderBadgePdf refuse un logo non conforme avant tout rendu", async () => {
    const { reg } = await brokenFixtures();
    const loaded = (await loadBadgeRegistration(reg.id))!;
    await expect(renderBadgePdf(loaded)).rejects.toBeInstanceOf(EventImagesNoncompliantError);
    expect(fakeExporter.calls).toEqual([]);
  }, 30_000);

  it("renderBadgePdf rend un PDF quand le logo est conforme", async () => {
    const fx = await createBadgeFixtures();
    const reg = await fx.addRegistration();
    const template = await makeFramedTemplate(fx.admin.id, { logo: { w: 68, h: 68 } });
    const logo = await putTestImage(`test-2a/ok-logo-${reg.id}.png`, makePng(136, 136), "image/png");
    await prisma.event.update({
      where: { id: fx.event.id },
      data: { badgeTemplateId: template.id, logo, logoWidth: 136, logoHeight: 136 },
    });
    const { pdf } = await renderBadgePdf((await loadBadgeRegistration(reg.id))!);
    expect(Buffer.from(pdf).toString("latin1", 0, 5)).toBe("%PDF-");
  }, 30_000);

  it("renderBadgeHtml n'est pas bloque", async () => {
    const { reg } = await brokenFixtures();
    const { document } = await renderBadgeHtml((await loadBadgeRegistration(reg.id))!);
    expect(document.frozen).toBe(true);
  }, 30_000);

  it("un template qui n'utilise pas le logo n'est jamais bloque", async () => {
    const fx = await createBadgeFixtures();
    const reg = await fx.addRegistration();
    const logo = await putTestImage(`test-2a/unused-logo-${reg.id}.png`, makePng(300, 100), "image/png");
    await prisma.event.update({ where: { id: fx.event.id }, data: { logo, logoWidth: 300, logoHeight: 100 } });
    const { pdf } = await renderBadgePdf((await loadBadgeRegistration(reg.id))!);
    expect(pdf.length).toBeGreaterThan(0);
  }, 30_000);
});

describe("GET …/badges/[badgeId]", () => {
  async function get(orgId: string, eventId: string, badgeId: string, query = "") {
    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/badges/[badgeId]/route");
    return GET(
      new NextRequest(`http://localhost/api/org/${orgId}/events/${eventId}/badges/${badgeId}${query}`),
      { params: Promise.resolve({ orgId, eventId, badgeId }) },
    );
  }

  it("PDF : 422 EVENT_IMAGES_NONCOMPLIANT avec le message", async () => {
    const { org, event, reg } = await brokenFixtures();
    const res = await get(org.id, event.id, reg.id);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("EVENT_IMAGES_NONCOMPLIANT");
    expect(body.message).toBe(NONCOMPLIANT_LOGO_MESSAGE);
  }, 30_000);

  it("aperçu HTML : 200 avec les en-têtes d'avertissement", async () => {
    const { org, event, reg } = await brokenFixtures();
    const res = await get(org.id, event.id, reg.id, "?format=html");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-event-images")).toBe("noncompliant");
    expect(res.headers.get("x-event-images-slots")).toBe("logo");
  }, 30_000);

  it("événement conforme : aucun en-tête", async () => {
    const fx = await createBadgeFixtures();
    const reg = await fx.addRegistration();
    const res = await get(fx.org.id, fx.event.id, reg.id, "?format=html");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-event-images")).toBeNull();
  }, 30_000);
});

describe("planches et exports", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  async function printSetup() {
    const fx = await seedPrintFixture();
    const staff = await makeStaff("STAFF_PRINTER");
    const layout = await makePrintLayout();
    await breakEventLogo(fx.event.id, staff.id);
    return { ...fx, staff, layout };
  }

  it("createGeneration (ALL) refuse et ne crée aucune ligne", async () => {
    const { event, staff, layout } = await printSetup();
    await expect(
      createGeneration({ eventId: event.id, layoutId: layout.id, selection: { mode: "ALL" }, duplex: false, userId: staff.id }),
    ).rejects.toBeInstanceOf(EventImagesNoncompliantError);
    expect(await prisma.printSheetGeneration.count()).toBe(0);
  });

  it("createGeneration (REQUEST) refuse et ne crée aucune ligne", async () => {
    const fx = await printSetup();
    const request = await makeRequest(fx, { status: "PAID" });
    await prisma.printRequestItem.create({
      data: { requestId: request.id, registrationId: fx.approved[0].id, position: 0 },
    });
    await expect(
      createGeneration({
        eventId: fx.event.id,
        layoutId: fx.layout.id,
        selection: { mode: "REQUEST" },
        duplex: false,
        userId: fx.staff.id,
        printRequestId: request.id,
      }),
    ).rejects.toBeInstanceOf(EventImagesNoncompliantError);
    expect(await prisma.printSheetGeneration.count()).toBe(0);
  });

  it("createZipExport refuse et ne crée aucune ligne", async () => {
    const { event, staff, approved } = await printSetup();
    await expect(
      createZipExport({ eventId: event.id, registrationIds: [approved[0].id], userId: staff.id }),
    ).rejects.toBeInstanceOf(EventImagesNoncompliantError);
    expect(await prisma.printSheetGeneration.count()).toBe(0);
  });

  it("POST /api/platform/print/sheets : 422", async () => {
    const { event, staff, layout } = await printSetup();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: staff.id, email: staff.email, name: staff.name, isStaff: true },
    } as never);
    const { POST } = await import("@/app/api/platform/print/sheets/route");
    const res = await POST(
      new NextRequest("http://localhost/api/platform/print/sheets", {
        method: "POST",
        body: JSON.stringify({ eventId: event.id, layoutId: layout.id, selection: { mode: "ALL" } }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("EVENT_IMAGES_NONCOMPLIANT");
  });

  it("POST …/badges/exports : 422", async () => {
    const { org, event, owner, approved } = await printSetup();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: owner.id, email: owner.email, name: owner.name, isStaff: false },
    } as never);
    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/badges/exports/route");
    const res = await POST(
      new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/exports`, {
        method: "POST",
        body: JSON.stringify({ ids: [approved[0].id] }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("EVENT_IMAGES_NONCOMPLIANT");
  });

  it("un export déjà en cours reste renvoyé tel quel même si l'événement est devenu non conforme", async () => {
    const { event, staff, approved } = await printSetup();
    const existing = await prisma.printSheetGeneration.create({
      data: {
        output: "ZIP",
        eventId: event.id,
        registrationIds: [approved[0].id],
        badgeCount: 1,
        createdById: staff.id,
        status: "PENDING",
      },
    });
    const { generation, reused } = await createZipExport({
      eventId: event.id,
      registrationIds: [approved[0].id],
      userId: staff.id,
    });
    expect(reused).toBe(true);
    expect(generation.id).toBe(existing.id);
  });

  it("le worker échoue proprement (FAILED + message) sur un événement devenu non conforme", async () => {
    const { event, staff, approved } = await printSetup();
    const generation = await prisma.printSheetGeneration.create({
      data: {
        output: "ZIP",
        eventId: event.id,
        registrationIds: [approved[0].id],
        badgeCount: 1,
        createdById: staff.id,
        status: "RUNNING",
        lockedBy: "worker-2a",
        attempts: 1,
        heartbeatAt: new Date(),
      },
    });
    expect(await runGeneration(generation.id, "worker-2a", defaultRunDeps)).toBe("FAILED");
    const after = await prisma.printSheetGeneration.findUniqueOrThrow({ where: { id: generation.id } });
    expect(after.status).toBe("FAILED");
    expect(after.error).toContain("Images de l'évènement à recadrer");
    expect(fakeExporter.calls).toEqual([]);
  });
});
