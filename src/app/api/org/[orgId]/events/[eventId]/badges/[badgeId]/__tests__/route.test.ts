import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureReferenceTemplates, defaultTemplateId, familyTemplateId } from "@/lib/badge-templates/install";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

import { __TEST__ } from "@/lib/badge-templates/build-context";
import { RENDERER_UNAVAILABLE_MESSAGE } from "@/lib/renderer";
import { countPdfPages, fakeExporter } from "@/lib/__tests__/helpers/fake-exporter";

async function bodyToBuffer(res: Response): Promise<Buffer> {
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

let seq = 0;

async function setupFixtures(
  role: "ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER" = "ADMIN",
  opts: { orgOwner?: boolean } = {},
) {
  // Par defaut le user est OWNER de l'org (herite du role event ADMIN). Pour tester un
  // role event PUR (ex. VIEWER rejete faute de badge.print), passer { orgOwner: false }
  // afin que le role effectif ne soit pas remonte au niveau ADMIN par l'appartenance org.
  const { orgOwner = true } = opts;
  const stamp = `${Date.now()}-${++seq}`;
  // v4 (plan 12) : les templates livres sont installes en base, plus compiles.
  await ensureReferenceTemplates("seed-test");
  const defaultId = (await defaultTemplateId())!;
  const rectoVersoId = (await familyTemplateId("recto-verso"))!;
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    update: { badgeTemplateId: defaultId },
    create: {
      id: "singleton",
      smtpHost: "mailpit",
      smtpPort: 1025,
      smtpFrom: "noreply@badge.local",
      smtpUser: "",
      smtpPassword: "",
      smtpSecure: false,
      recaptchaEnabled: false,
      recaptchaSiteKey: "",
      recaptchaSecretKey: "",
      badgeTemplateId: defaultId,
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: `tpl-admin-${stamp}@v2-12.test`,
      password: "x",
      name: "Tpl Admin",
      isStaff: false,
      emailVerifiedAt: new Date(),
    },
  });
  const org = await prisma.organization.create({
    data: { name: "Tpl Org", slug: `tpl-org-${stamp}` },
  });
  if (orgOwner) {
    await prisma.orgMembership.create({
      data: { userId: admin.id, orgId: org.id, role: "OWNER" },
    });
  }
  const event = await prisma.event.create({
    data: {
      orgId: org.id,
      title: "Tpl Salon",
      slug: `tpl-evt-${stamp}`,
      location: "Abidjan",
      date: new Date("2026-10-01"),
    },
  });
  await prisma.eventMembership.create({
    data: { userId: admin.id, eventId: event.id, role },
  });
  const category = await prisma.category.create({
    data: { eventId: event.id, name: "Visiteur", color: "#4f46e5", number: 1 },
  });
  const reg = await prisma.registration.create({
    data: {
      id: `BADGE-${stamp}`,
      eventId: event.id,
      categoryId: category.id,
      userId: admin.id,
      snapshotFirstName: "Awa",
      snapshotLastName: "Diallo",
      snapshotEmail: admin.email,
      snapshotStructure: "ENSEA",
      snapshotPhoto: "uploads/test/photo.jpg",
      snapshotIdDocumentType: "CNI",
      snapshotIdDocumentNumber: "X-1",
      snapshotIdDocument: "uploads/test/cni.pdf",
      status: "APPROVED",
    },
  });

  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: admin.id, email: admin.email, name: admin.name, isStaff: false },
  } as never);

  return { admin, org, event, reg, defaultId, rectoVersoId };
}

describe("GET /api/org/[orgId]/events/[eventId]/badges/[badgeId]", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("renvoie un PDF avec content-type application/pdf", async () => {
    const { org, event, reg } = await setupFixtures();
    const { GET } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/${reg.id}`);
    const res = await GET(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, badgeId: reg.id }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const buf = await bodyToBuffer(res);
    expect(buf.toString("latin1", 0, 5)).toBe("%PDF-");
  }, 30_000);

  it("rend 1 page quand le template effectif est la famille default", async () => {
    const { org, event, reg, defaultId } = await setupFixtures();
    const { GET } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/${reg.id}`);
    const res = await GET(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, badgeId: reg.id }),
    });
    const buf = await bodyToBuffer(res);
    expect(countPdfPages(buf)).toBe(1);
    expect(res.headers.get("x-template-id")).toBe(defaultId);
  }, 30_000);

  it("rend 2 pages quand l'evenement pointe sur la famille recto-verso", async () => {
    const { org, event, reg, rectoVersoId } = await setupFixtures();
    await prisma.event.update({
      where: { id: event.id },
      data: { badgeTemplateId: rectoVersoId },
    });
    const { GET } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/${reg.id}`);
    const res = await GET(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, badgeId: reg.id }),
    });
    const buf = await bodyToBuffer(res);
    expect(countPdfPages(buf)).toBe(2);
    expect(res.headers.get("x-template-id")).toBe(rectoVersoId);
  }, 30_000);

  it("repli sur la famille default quand badgeTemplateId est orphelin", async () => {
    const { org, event, reg, defaultId } = await setupFixtures();
    await prisma.event.update({
      where: { id: event.id },
      data: { badgeTemplateId: "id-inexistant-xyz" },
    });
    const { GET } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/${reg.id}`);
    const res = await GET(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, badgeId: reg.id }),
    });
    expect(res.headers.get("x-template-id")).toBe(defaultId);
  }, 30_000);

  it("retourne 403 EVENT_FORBIDDEN pour un VIEWER (pas de permission badge.print)", async () => {
    // VIEWER pur (sans OrgMembership OWNER) : n'a pas badge.print -> 403.
    const { org, event, reg } = await setupFixtures("VIEWER", { orgOwner: false });
    const { GET } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/${reg.id}`);
    const res = await GET(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, badgeId: reg.id }),
    });
    expect(res.status).toBe(403);
    const json = await res.json();
    // Garde par permission badge.print via withEventAuth : code standard des
    // routes event (remplace le "FORBIDDEN" ad-hoc de l'ancien double-verrou).
    expect(json.error).toBe("EVENT_FORBIDDEN");
  });

  const url = (org: { id: string }, event: { id: string }, reg: { id: string }, query = "") =>
    new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/${reg.id}${query}`);
  const paramsOf = (org: { id: string }, event: { id: string }, reg: { id: string }) => ({
    params: Promise.resolve({ orgId: org.id, eventId: event.id, badgeId: reg.id }),
  });

  it("500 RENDER_FAILED en JSON si le rendu echoue", async () => {
    const { org, event, reg } = await setupFixtures();
    const { GET } = await import("../route");
    fakeExporter.failNext("RENDER_FAILED");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(url(org, event, reg), paramsOf(org, event, reg));
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ error: "RENDER_FAILED", id: reg.id });
    expect(err).toHaveBeenCalledTimes(1);
    err.mockRestore();
  }, 30_000);

  it.each([
    ["UNAVAILABLE", ""],
    ["TIMEOUT", ""],
    ["UNAVAILABLE", "?format=html"],
    ["TIMEOUT", "?format=html"],
  ] as const)("503 RENDERER_UNAVAILABLE si le service repond %s %s", async (code, query) => {
    const { org, event, reg } = await setupFixtures();
    const { GET } = await import("../route");
    fakeExporter.failNext(code);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(url(org, event, reg, query), paramsOf(org, event, reg));
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("5");
    expect(await res.json()).toEqual({ error: "RENDERER_UNAVAILABLE", message: RENDERER_UNAVAILABLE_MESSAGE });
    err.mockRestore();
  }, 30_000);

  it("500 RENDER_FAILED avec le message pour un badge trop volumineux", async () => {
    const { org, event, reg } = await setupFixtures();
    const { GET } = await import("../route");
    const spy = vi
      .spyOn(__TEST__, "readFileAsDataUrl")
      .mockResolvedValue(`data:image/jpeg;base64,${"A".repeat(21 * 1024 * 1024)}`);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(url(org, event, reg), paramsOf(org, event, reg));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ error: "RENDER_FAILED", id: reg.id });
    expect(body.message).toMatch(/trop volumineux/);
    spy.mockRestore();
    err.mockRestore();
  }, 30_000);

  it("?format=html renvoie le document fige en JSON, sans cache", async () => {
    const { org, event, reg, defaultId } = await setupFixtures();
    const { GET } = await import("../route");
    const res = await GET(url(org, event, reg, "?format=html"), paramsOf(org, event, reg));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-template-id")).toBe(defaultId);
    const doc = await res.json();
    expect(doc.frozen).toBe(true);
    expect(doc.pages).toEqual([1]);
    expect(doc.html).not.toContain("<script");
    expect(doc.html).toContain("Diallo");
  }, 30_000);

  it("?format=png est refuse (400 VALIDATION)", async () => {
    const { org, event, reg } = await setupFixtures();
    const { GET } = await import("../route");
    const res = await GET(url(org, event, reg, "?format=png"), paramsOf(org, event, reg));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "VALIDATION" });
  });

  it("retourne 404 NOT_FOUND pour un badgeId inexistant", async () => {
    const { org, event } = await setupFixtures();
    const { GET } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/ghost-xyz`);
    const res = await GET(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, badgeId: "ghost-xyz" }),
    });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("NOT_FOUND");
  });

  it("repli sur la famille default quand PlatformSettings (singleton) est absent", async () => {
    const { org, event, reg, defaultId } = await setupFixtures();
    await prisma.platformSettings.delete({ where: { id: "singleton" } });
    const { GET } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/${reg.id}`);
    const res = await GET(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, badgeId: reg.id }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-template-id")).toBe(defaultId);
  }, 30_000);

  it("nomme le fichier d'apres l'inscription, en ligne par defaut", async () => {
    const { org, event, reg } = await setupFixtures();
    const { GET } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/${reg.id}`);
    const res = await GET(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, badgeId: reg.id }),
    });
    expect(res.headers.get("content-disposition")).toBe(`inline; filename="${reg.id}-awa-diallo.pdf"`);
  }, 30_000);

  it("?download=1 force le telechargement", async () => {
    const { org, event, reg } = await setupFixtures();
    const { GET } = await import("../route");
    const req = new NextRequest(
      `http://localhost/api/org/${org.id}/events/${event.id}/badges/${reg.id}?download=1`,
    );
    const res = await GET(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, badgeId: reg.id }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe(`attachment; filename="${reg.id}-awa-diallo.pdf"`);
  }, 30_000);

  it("retourne 404 pour une inscription d'un autre evenement", async () => {
    // `other` d'abord : le second setupFixtures fixe la session sur son propre admin.
    const other = await setupFixtures();
    const { org, event } = await setupFixtures();
    const { GET } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/${other.reg.id}`);
    const res = await GET(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, badgeId: other.reg.id }),
    });
    expect(res.status).toBe(404);
  });

  it("imprime les consignes de l'evenement, l'initiale de categorie et l'All Access", async () => {
    const { org, event, reg } = await setupFixtures("ADMIN");
    const layout = {
      formatVersion: 3,
      family: "consignes-test",
      label: "Consignes",
      description: "",
      category: "badge",
      page: { widthPx: 320, heightPx: 460, count: 1 },
      variables: [
        { name: "categoryName", kind: "text", label: "Categorie" },
        { name: "isAllAccess", kind: "boolean", label: "All Access" },
        { name: "securityInstructions", kind: "list", label: "Consignes" },
      ],
      blocks: [
        {
          type: "text", page: 1, x: 10, y: 10, w: 100, h: 40,
          text: "[{categoryName|initiale}]",
          style: { sizePx: 20, color: "#000000", overflow: "clip" },
        },
        {
          type: "text", page: 1, x: 10, y: 60, w: 200, h: 30,
          text: "ALL ACCESS",
          style: { sizePx: 14, color: "#000000", overflow: "clip" },
          visibleIf: { variable: "isAllAccess", equals: true },
        },
        {
          type: "list", page: 1, x: 10, y: 100, w: 280, h: 300,
          source: "securityInstructions",
          bullet: { type: "disc", sizePx: 3, color: "#000000", gapPx: 5 },
          items: { maxItems: 5, maxChars: 120, maxLines: 3, lineHeightPx: 13 },
          style: { sizePx: 10, color: "#000000" },
        },
      ],
    };
    const row = await prisma.installedBadgeTemplate.create({
      data: {
        family: "consignes-test", version: 1, label: "Consignes", description: "",
        pages: 1, pageWidthPx: 320, pageHeightPx: 460, layout,
        bindings: {
          categoryName: "category.name",
          isAllAccess: "badge.allAccess",
          securityInstructions: "event.securityInstructions",
        },
        assetPrefix: "badge-templates/consignes-test/", formatVersion: 3, installedById: "u1",
      },
    });
    try {
      await prisma.event.update({
        where: { id: event.id },
        data: { badgeTemplateId: row.id, securityInstructions: ["Restez dans la zone indiquee."] },
      });
      await prisma.registration.update({ where: { id: reg.id }, data: { allAccessGranted: true } });

      const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/badges/[badgeId]/route");
      const call = () =>
        GET(new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/${reg.id}?format=html`), {
          params: Promise.resolve({ orgId: org.id, eventId: event.id, badgeId: reg.id }),
        });

      const avec = (await (await call()).json()).html as string;
      expect(avec).toContain("[V]");
      expect(avec).toContain("ALL ACCESS");
      expect(avec).toContain("Restez dans la zone indiquee.");

      // L'All Access retire apres coup disparait du badge suivant.
      await prisma.registration.update({ where: { id: reg.id }, data: { allAccessGranted: false } });
      const sans = (await (await call()).json()).html as string;
      expect(sans).not.toContain("ALL ACCESS");
    } finally {
      await prisma.installedBadgeTemplate.delete({ where: { id: row.id } });
    }
  });

  it("imprime les options du badge : defaut, valeur reglee et interrupteur coupe", async () => {
    const { org, event, reg } = await setupFixtures("ADMIN");
    const layout = {
      formatVersion: 3,
      family: "options-test",
      label: "Options",
      description: "",
      category: "badge",
      page: { widthPx: 320, heightPx: 460, count: 1 },
      variables: [
        { name: "showColorBar", kind: "boolean", label: "Bandeau", sample: true },
        { name: "zone", kind: "text", label: "Zone" },
        { name: "event.bannerDataUrl", kind: "image", label: "Banniere" },
        { name: "visuel", kind: "image", label: "Visuel" },
      ],
      blocks: [
        {
          type: "text", page: 1, x: 10, y: 10, w: 200, h: 30,
          text: "BANDEAU",
          style: { sizePx: 14, color: "#000000", overflow: "clip" },
          visibleIf: { variable: "showColorBar", equals: true },
        },
        {
          type: "text", page: 1, x: 10, y: 60, w: 200, h: 30,
          text: "{zone}",
          style: { sizePx: 14, color: "#000000", overflow: "clip" },
        },
      ],
    };
    const row = await prisma.installedBadgeTemplate.create({
      data: {
        family: "options-test", version: 1, label: "Options", description: "",
        pages: 1, pageWidthPx: 320, pageHeightPx: 460, layout,
        bindings: {
          showColorBar: "option",
          zone: "option",
          visuel: "option",
          "event.bannerDataUrl": "event.bannerDataUrl",
        },
        assetPrefix: "badge-templates/options-test/", formatVersion: 3, installedById: "u1",
      },
    });
    try {
      await prisma.event.update({
        where: { id: event.id },
        data: { badgeTemplateId: row.id, templateOptions: { zone: "Zone C", visuel: "absent/visuel.png" } },
      });
      const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/badges/[badgeId]/route");
      const call = () =>
        GET(new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/${reg.id}?format=html`), {
          params: Promise.resolve({ orgId: org.id, eventId: event.id, badgeId: reg.id }),
        });

      const avec = (await (await call()).json()).html as string;
      expect(avec).toContain("BANDEAU");
      expect(avec).toContain("Zone C");

      await prisma.event.update({
        where: { id: event.id },
        data: { templateOptions: { zone: "Zone C", showColorBar: false } },
      });
      const sans = (await (await call()).json()).html as string;
      expect(sans).not.toContain("BANDEAU");
      expect(sans).toContain("Zone C");
    } finally {
      await prisma.installedBadgeTemplate.delete({ where: { id: row.id } });
    }
  });
});
