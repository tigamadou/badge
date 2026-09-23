import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";

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
    formatVersion: 2,
    family: "salon-2027",
    label: "Badge Salon",
    description: "Un badge de test.",
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

function inspectRequest(body: FormData | string, headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/platform/badge-templates/inspect", {
    method: "POST",
    body,
    headers,
  });
}

function formWith(archive: Buffer): FormData {
  const form = new FormData();
  form.set("archive", new File([new Uint8Array(archive)], "template.zip", { type: "application/zip" }));
  return form;
}

async function inspect(body: FormData | string, headers?: Record<string, string>) {
  const { POST } = await import("../route");
  return POST(inspectRequest(body, headers));
}

async function asAdmin() {
  const staff = await makeStaff("STAFF_ADMIN");
  withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });
  return staff;
}

describe("POST /api/platform/badge-templates/inspect", () => {
  beforeEach(async () => {
    await prisma.installedBadgeTemplate.deleteMany({});
  });

  it("rend les variables, la suggestion et les sources, sans rien installer", async () => {
    await asAdmin();
    const res = await inspect(formWith(await archiveOf({ "manifest.json": JSON.stringify(manifestOf()) })));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.variables.map((v: { name: string }) => v.name)).toEqual(["participant.firstName", "structure"]);
    // Identite pour le nom de source, rien pour le nom libre : il reste a decider.
    expect(body.suggested).toEqual({ "participant.firstName": "participant.firstName" });
    expect(body.sources["category.color"]).toBe("color");
    expect(Object.keys(body.sources)).toHaveLength(15);
    expect(await prisma.installedBadgeTemplate.count()).toBe(0);
  });

  it("refuse sans session (401)", async () => {
    // Meme garde que la route d'installation : l'inspection lit le contenu d'un
    // paquet, ce n'est pas une surface publique.
    noSession();
    const res = await inspect(formWith(await archiveOf({ "manifest.json": JSON.stringify(manifestOf()) })));
    expect(res.status).toBe(401);
  });

  it("refuse un STAFF_SUPPORT (403)", async () => {
    const staff = await makeStaff("STAFF_SUPPORT");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });
    const res = await inspect(formWith(await archiveOf({ "manifest.json": JSON.stringify(manifestOf()) })));
    expect(res.status).toBe(403);
  });

  it("propage une erreur non-AuthError levee pendant le controle de role", async () => {
    await asAdmin();
    const spy = vi.spyOn(prisma.user, "findUnique").mockRejectedValueOnce(new Error("boom-inspect"));
    await expect(
      inspect(formWith(await archiveOf({ "manifest.json": JSON.stringify(manifestOf()) }))),
    ).rejects.toThrow("boom-inspect");
    spy.mockRestore();
  });

  it("refuse une requete sans fichier (400)", async () => {
    await asAdmin();
    const res = await inspect(new FormData());
    expect(res.status).toBe(400);
    expect((await res.json()).errors.join()).toMatch(/fichier manquant/i);
  });

  it("refuse une requete dont le corps n'est pas un formulaire (400)", async () => {
    await asAdmin();
    const res = await inspect("pas un formulaire", { "content-type": "multipart/form-data; boundary=xxx" });
    expect(res.status).toBe(400);
    expect((await res.json()).errors.join()).toMatch(/fichier manquant/i);
  });

  it("refuse une archive depassant la borne de taille (400)", async () => {
    await asAdmin();
    const form = new FormData();
    form.set("archive", new File([new Uint8Array(11 * 1024 * 1024)], "gros.zip"));
    const res = await inspect(form);
    expect(res.status).toBe(400);
    expect((await res.json()).errors.join()).toMatch(/taille/i);
  });

  it("refuse un paquet invalide (400) en listant les erreurs", async () => {
    await asAdmin();
    const res = await inspect(formWith(await archiveOf({ "assets/f.png": PNG })));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.join()).toMatch(/manifest\.json/i);
  });
});
