import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { ensureReferenceTemplates } from "@/lib/badge-templates/install";
import { RENDERER_UNAVAILABLE_MESSAGE } from "@/lib/renderer";
import { fakeExporter } from "@/lib/__tests__/helpers/fake-exporter";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

type StaffRoleStr = "SUPER_ADMIN" | "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_OBSERVER";

function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

function noSession() {
  vi.mocked(getServerSession).mockResolvedValue(null as never);
}

async function makeStaff(staffRole: StaffRoleStr) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return prisma.user.create({
    data: {
      email: `staff-${suffix}@bt.test`,
      password: "x",
      name: "Staff BT",
      isStaff: true,
      staffRole,
    },
  });
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function manifestOf(overrides: Record<string, unknown> = {}) {
  return {
    formatVersion: 3,
    family: "salon-2027",
    label: "Badge Salon",
    description: "Un badge de test.",
    category: "badge",
    page: { widthPx: 1011, heightPx: 638, count: 1 },
    variables: [
      { name: "participant.firstName", kind: "text", label: "Prénom", sample: "Awa" },
      { name: "structure", kind: "text", label: "Structure", sample: "Organisation" },
    ],
    blocks: [
      {
        type: "text",
        page: 1,
        x: 4,
        y: 4,
        w: 400,
        h: 60,
        text: "{participant.firstName} — {structure}",
        style: { sizePx: 50, color: "#0f172a", overflow: "clip" },
      },
    ],
    ...overrides,
  };
}

async function archiveOf(files: Record<string, Buffer | string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({ type: "nodebuffer" });
}

function requestWith(archive: Buffer, bindings?: string): NextRequest {
  const form = new FormData();
  form.set("archive", new File([new Uint8Array(archive)], "template.zip", { type: "application/zip" }));
  if (bindings !== undefined) form.set("bindings", bindings);
  return new NextRequest("http://localhost/api/platform/badge-templates", {
    method: "POST",
    body: form,
  });
}

async function post(archive: Buffer, bindings?: string) {
  const { POST } = await import("../route");
  return POST(requestWith(archive, bindings), { params: Promise.resolve({}) });
}

describe("POST /api/platform/badge-templates", () => {
  beforeEach(async () => {
    await prisma.installedBadgeTemplate.deleteMany({});
    await prisma.activityLog.deleteMany({ where: { type: "BADGE_TEMPLATE_INSTALLED" } });
  });

  it("installe un paquet valide (201) et journalise", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });

    const res = await post(await archiveOf({ "manifest.json": JSON.stringify(manifestOf()) }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ family: "salon-2027", version: 1 });

    const row = await prisma.installedBadgeTemplate.findUnique({ where: { id: body.id } });
    // Ce paquet ne declare pas d'image : pas d'apercu, mais une epreuve PNG.
    expect(row?.previewPath).toBeNull();
    expect(row?.proofPath).toBe(`badge-templates/${body.id}/proof.png`);
    expect(row?.installedById).toBe(staff.id);

    const log = await prisma.activityLog.findFirst({ where: { type: "BADGE_TEMPLATE_INSTALLED" } });
    expect(log?.targetId).toBe(body.id);
  });

  it("repond 503 sans rien installer quand le service de rendu est indisponible", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });
    fakeExporter.failNext("UNAVAILABLE");

    const res = await post(await archiveOf({ "manifest.json": JSON.stringify(manifestOf()) }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "RENDERER_UNAVAILABLE", message: RENDERER_UNAVAILABLE_MESSAGE });
    expect(await prisma.installedBadgeTemplate.count()).toBe(0);
    expect(await prisma.activityLog.count({ where: { type: "BADGE_TEMPLATE_INSTALLED" } })).toBe(0);
  });

  it("repond 400 INVALID_PACKAGE quand le rendu echoue (RENDER_FAILED)", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });
    fakeExporter.failNext("RENDER_FAILED");

    const res = await post(await archiveOf({ "manifest.json": JSON.stringify(manifestOf()) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_PACKAGE");
    expect(await prisma.installedBadgeTemplate.count()).toBe(0);
  });

  it("refuse sans session (401)", async () => {
    noSession();
    const res = await post(await archiveOf({ "manifest.json": JSON.stringify(manifestOf()) }));
    expect(res.status).toBe(401);
  });

  it("refuse un STAFF_SUPPORT (403)", async () => {
    const staff = await makeStaff("STAFF_SUPPORT");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });

    const res = await post(await archiveOf({ "manifest.json": JSON.stringify(manifestOf()) }));
    expect(res.status).toBe(403);
    expect(await prisma.installedBadgeTemplate.count()).toBe(0);
  });

  it("refuse une archive invalide (400) en listant les erreurs", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });

    const res = await post(await archiveOf({ "assets/f.png": PNG }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors.join()).toMatch(/manifest\.json/i);
    expect(await prisma.installedBadgeTemplate.count()).toBe(0);
  });

  it("refuse une requete sans fichier (400)", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });

    const { POST } = await import("../route");
    const res = await POST(
      new NextRequest("http://localhost/api/platform/badge-templates", {
        method: "POST",
        body: new FormData(),
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(400);
  });

  it("reinstaller une famille livree en cree une nouvelle version", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });

    // v4 (plan 12) : plus de registre compile, donc plus de famille reservee.
    // `default` est un template installe comme un autre : le reinstaller le versionne.
    await ensureReferenceTemplates(staff.id);
    const res = await post(
      await archiveOf({ "manifest.json": JSON.stringify(manifestOf({ family: "default" })) }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).version).toBe(2);
  });

  it("incremente la version a la reinstallation d'une meme famille", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });

    const first = await post(await archiveOf({ "manifest.json": JSON.stringify(manifestOf()) }));
    expect((await first.json()).version).toBe(1);

    const second = await post(
      await archiveOf({ "manifest.json": JSON.stringify(manifestOf({ label: "Corrige" })) }),
    );
    const body = await second.json();
    expect(body.version).toBe(2);

    // Immuabilite : la version 1 conserve son libelle d'origine.
    const rows = await prisma.installedBadgeTemplate.findMany({ orderBy: { version: "asc" } });
    expect(rows).toHaveLength(2);
    expect(rows[0].label).toBe("Badge Salon");
    expect(rows[1].label).toBe("Corrige");
  });

  it("installe un paquet embarquant une ressource", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });

    const manifest = manifestOf({
      blocks: [
        { type: "rect", page: 1, x: 0, y: 0, w: 1011, h: 638, image: { asset: "assets/fond.png" } },
      ],
    });
    const res = await post(
      await archiveOf({ "manifest.json": JSON.stringify(manifest), "assets/fond.png": PNG }),
    );
    expect(res.status).toBe(201);

    const body = await res.json();
    const row = await prisma.installedBadgeTemplate.findUnique({ where: { id: body.id } });
    expect(row?.assetPrefix).toBe(`badge-templates/${body.id}/`);
  });

  it("refuse une requete dont le corps n'est pas un formulaire (400)", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });

    const { POST } = await import("../route");
    const res = await POST(
      new NextRequest("http://localhost/api/platform/badge-templates", {
        method: "POST",
        body: "pas un formulaire",
        headers: { "content-type": "multipart/form-data; boundary=xxx" },
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).errors.join()).toMatch(/fichier manquant/i);
  });

  it("refuse une archive depassant la borne de taille (400)", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });

    const { POST } = await import("../route");
    const form = new FormData();
    // 11 Mo : la borne est verifiee sur la taille annoncee, avant toute lecture.
    form.set("archive", new File([new Uint8Array(11 * 1024 * 1024)], "gros.zip"));
    const res = await POST(
      new NextRequest("http://localhost/api/platform/badge-templates", {
        method: "POST",
        body: form,
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).errors.join()).toMatch(/taille/i);
  });

  it("propage une erreur non-AuthError levee pendant le controle de role", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });
    const spy = vi.spyOn(prisma.user, "findUnique").mockRejectedValueOnce(new Error("boom-bt"));

    await expect(post(await archiveOf({ "manifest.json": JSON.stringify(manifestOf()) }))).rejects.toThrow(
      "boom-bt",
    );
    spy.mockRestore();
  });

  it("calcule les liaisons cote serveur et ignore celles du client", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });
    const expected = { "participant.firstName": "participant.firstName", structure: "option" };

    for (const sent of [undefined, JSON.stringify({ "participant.firstName": null })]) {
      await prisma.installedBadgeTemplate.deleteMany({});
      const res = await post(await archiveOf({ "manifest.json": JSON.stringify(manifestOf()) }), sent);
      expect(res.status).toBe(201);
      const row = await prisma.installedBadgeTemplate.findUnique({ where: { id: (await res.json()).id } });
      expect(row?.bindings).toEqual(expected);
    }
  });

  it("refuse un paquet a ancien nom (400)", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });
    const manifest = manifestOf({
      variables: [{ name: "firstName", kind: "text", label: "Prénom", sample: "Awa" }],
      blocks: [
        {
          type: "text",
          page: 1,
          x: 4,
          y: 4,
          w: 400,
          h: 60,
          text: "{firstName}",
          style: { sizePx: 50, color: "#0f172a", overflow: "clip" },
        },
      ],
    });

    const res = await post(await archiveOf({ "manifest.json": JSON.stringify(manifest) }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toEqual([
      'variable "firstName" : ancien nom, réexporter le template depuis le studio (attendu "participant.firstName").',
    ]);
    expect(await prisma.installedBadgeTemplate.count()).toBe(0);
  });

  it("refuse une cle du contrat declaree avec un mauvais type (400)", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });
    const manifest = manifestOf({
      variables: [{ name: "participant.firstName", kind: "image", label: "Prénom" }],
      blocks: [{ type: "rect", page: 1, x: 0, y: 0, w: 10, h: 10, fill: "#000000" }],
    });

    const res = await post(await archiveOf({ "manifest.json": JSON.stringify(manifest) }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toEqual([
      'variable "participant.firstName" : badge la fournit en text, déclarée en image.',
    ]);
    expect(await prisma.installedBadgeTemplate.count()).toBe(0);
  });

});

describe("GET /api/platform/badge-templates", () => {
  beforeEach(async () => {
    await prisma.installedBadgeTemplate.deleteMany({});
  });

  it("liste le catalogue pour un STAFF_OBSERVER", async () => {
    const staff = await makeStaff("STAFF_OBSERVER");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });

    await prisma.installedBadgeTemplate.create({
      data: {
        family: "salon",
        version: 1,
        label: "Salon",
        description: "",
        pages: 1,
        pageWidthPx: 1011,
        pageHeightPx: 638,
        layout: {},
        assetPrefix: "x/",
        formatVersion: 3,
        installedById: staff.id,
      },
    });

    const { GET } = await import("../route");
    const res = await GET(new NextRequest("http://localhost/api/platform/x"), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect((await res.json()).templates).toHaveLength(1);
  });

  it("refuse sans session (401)", async () => {
    noSession();
    const { GET } = await import("../route");
    expect((await GET(new NextRequest("http://localhost/api/platform/x"), { params: Promise.resolve({}) })).status).toBe(401);
  });

  it("refuse un utilisateur non staff (403)", async () => {
    const client = await prisma.user.create({
      data: {
        email: `client-${Date.now()}-${Math.floor(Math.random() * 1e6)}@bt.test`,
        password: "x",
        name: "Client",
        isStaff: false,
      },
    });
    withSession({ id: client.id, email: client.email, name: client.name, isStaff: false });

    const { GET } = await import("../route");
    expect((await GET(new NextRequest("http://localhost/api/platform/x"), { params: Promise.resolve({}) })).status).toBe(403);
  });

  it("propage une erreur non-AuthError levee pendant le controle de role", async () => {
    const staff = await makeStaff("STAFF_OBSERVER");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });
    const spy = vi.spyOn(prisma.user, "findUnique").mockRejectedValueOnce(new Error("boom-get"));

    const { GET } = await import("../route");
    await expect(GET(new NextRequest("http://localhost/api/platform/x"), { params: Promise.resolve({}) })).rejects.toThrow("boom-get");
    spy.mockRestore();
  });
});
