import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { listPrefix } from "@/lib/storage";
import { makeEvent, makeStaff, seedFactories } from "@/test/factories";
import { makeFramedTemplate, makePng, makeWebpHeader } from "@/test/factories-2a";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

async function seedOrgWithMember(role: "OWNER" | "MANAGER" | "AUDITOR") {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const u = await prisma.user.create({ data: { email: `u-${stamp}@x.test`, password: "x", name: "U" } });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${stamp}` } });
  await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role } });
  withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
  return { u, org };
}

seedFactories(2204);

function makeReq(
  orgId: string,
  file?: { name: string; type: string; bytes: Buffer },
  query = "",
): NextRequest {
  const fd = new FormData();
  if (file) {
    const ab = new ArrayBuffer(file.bytes.byteLength);
    new Uint8Array(ab).set(file.bytes);
    fd.append("file", new Blob([ab], { type: file.type }), file.name);
  }
  return new NextRequest(`http://localhost/api/org/${orgId}/upload${query}`, { method: "POST", body: fd });
}

describe("POST /api/org/[orgId]/upload", () => {
  beforeEach(async () => {
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { POST } = await import("@/app/api/org/[orgId]/upload/route");
    const res = await POST(makeReq("whatever"), { params: Promise.resolve({ orgId: "whatever" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for AUDITOR (below MANAGER)", async () => {
    const { org } = await seedOrgWithMember("AUDITOR");
    const { POST } = await import("@/app/api/org/[orgId]/upload/route");
    const res = await POST(
      makeReq(org.id, { name: "p.jpg", type: "image/jpeg", bytes: Buffer.from("x") }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 NO_FILE when the form has no file", async () => {
    const { org } = await seedOrgWithMember("MANAGER");
    const { POST } = await import("@/app/api/org/[orgId]/upload/route");
    const res = await POST(makeReq(org.id), { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("NO_FILE");
  });

  it("returns 400 NO_FILE when the multipart body cannot be parsed (form=null)", async () => {
    const { org } = await seedOrgWithMember("MANAGER");
    const { POST } = await import("@/app/api/org/[orgId]/upload/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/upload`, {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=broken" },
      body: "not-a-valid-multipart-body",
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("NO_FILE");
  });

  it("returns 415 BAD_TYPE for a disallowed mime (PDF)", async () => {
    const { org } = await seedOrgWithMember("MANAGER");
    const { POST } = await import("@/app/api/org/[orgId]/upload/route");
    const res = await POST(
      makeReq(org.id, { name: "d.pdf", type: "application/pdf", bytes: Buffer.from("%PDF") }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect(res.status).toBe(415);
    const json = await res.json();
    expect(json.code).toBe("BAD_TYPE");
  });

  it("returns 413 TOO_LARGE for files over 5 Mo", async () => {
    const { org } = await seedOrgWithMember("MANAGER");
    const { POST } = await import("@/app/api/org/[orgId]/upload/route");
    const big = Buffer.alloc(5 * 1024 * 1024 + 1);
    const res = await POST(
      makeReq(org.id, { name: "big.jpg", type: "image/jpeg", bytes: big }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.code).toBe("TOO_LARGE");
  });

  it("accepts a valid JPEG and returns an org-scoped storage key", async () => {
    const { org } = await seedOrgWithMember("MANAGER");
    const { POST } = await import("@/app/api/org/[orgId]/upload/route");
    const res = await POST(
      makeReq(org.id, { name: "p.jpg", type: "image/jpeg", bytes: Buffer.from("xxx") }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.storageKey).toMatch(new RegExp(`^orgs/${org.id}/images/.+\\.jpg$`));
  });

  it("accepts PNG and WebP too, with the matching extension (OWNER satisfies MANAGER)", async () => {
    const { org } = await seedOrgWithMember("OWNER");
    const { POST } = await import("@/app/api/org/[orgId]/upload/route");

    const resPng = await POST(
      makeReq(org.id, { name: "p.png", type: "image/png", bytes: Buffer.from("x") }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect(resPng.status).toBe(200);
    expect((await resPng.json()).storageKey).toMatch(/\.png$/);

    const resWebp = await POST(
      makeReq(org.id, { name: "p.webp", type: "image/webp", bytes: Buffer.from("x") }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect(resWebp.status).toBe(200);
    expect((await resWebp.json()).storageKey).toMatch(/\.webp$/);
  });
});

describe("POST /api/org/[orgId]/upload?purpose=", () => {
  beforeEach(async () => {
    await prisma.orgMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  async function setup(frames: Parameters<typeof makeFramedTemplate>[1] = { logo: { w: 68, h: 68 }, banner: { w: 750, h: 250 } }) {
    const { org } = await seedOrgWithMember("MANAGER");
    const staff = await makeStaff("SUPER_ADMIN");
    const template = await makeFramedTemplate(staff.id, frames);
    const event = await makeEvent(org.id, { badgeTemplateId: template.id });
    const { POST } = await import("@/app/api/org/[orgId]/upload/route");
    const call = (file: { name: string; type: string; bytes: Buffer }, query: string) =>
      POST(makeReq(org.id, file, query), { params: Promise.resolve({ orgId: org.id }) });
    return { org, event, call };
  }
  const png = (w: number, h: number) => ({ name: "i.png", type: "image/png", bytes: makePng(w, h) });
  const count = async (orgId: string) => (await listPrefix(`orgs/${orgId}/images/`)).length;

  it("accepte un logo au bon ratio et rend ses dimensions", async () => {
    const { event, call } = await setup();
    const res = await call(png(136, 136), `?purpose=logo&eventId=${event.id}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ width: 136, height: 136, storageKey: expect.any(String) });
  });

  it("refuse un logo hors ratio sans rien ecrire", async () => {
    const { org, event, call } = await setup();
    const before = await count(org.id);
    const res = await call(png(300, 100), `?purpose=logo&eventId=${event.id}`);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json).toMatchObject({ code: "IMAGE_RATIO", message: "Ratio attendu 1:1, par ex. 136 × 136 px." });
    expect(json.error).toBe(json.message);
    expect(await count(org.id)).toBe(before);
  });

  it("controle la banniere contre son propre cadre", async () => {
    const { event, call } = await setup();
    expect((await call(png(1500, 500), `?purpose=banner&eventId=${event.id}`)).status).toBe(200);
    expect((await call(png(136, 136), `?purpose=banner&eventId=${event.id}`)).status).toBe(422);
  });

  it("n'impose rien quand le template n'a pas la variable", async () => {
    const { event, call } = await setup({});
    expect((await call(png(300, 100), `?purpose=logo&eventId=${event.id}`)).status).toBe(200);
  });

  it("refuse WebP pour logo / banniere mais l'accepte en original", async () => {
    const { event, call } = await setup();
    const webp = { name: "i.webp", type: "image/webp", bytes: makeWebpHeader(300, 100) };
    const refused = await call(webp, `?purpose=logo&eventId=${event.id}`);
    expect(refused.status).toBe(415);
    expect((await refused.json()).code).toBe("UNSUPPORTED_FORMAT");
    const original = await call(webp, "?purpose=original");
    expect(original.status).toBe(200);
    expect(Object.keys(await original.json())).toEqual(["storageKey"]);
  });

  it("refuse un fichier .png qui contient du texte", async () => {
    const { event, call } = await setup();
    const res = await call(
      { name: "i.png", type: "image/png", bytes: Buffer.from("texte") },
      `?purpose=logo&eventId=${event.id}`,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_IMAGE");
  });

  it("refuse un usage inconnu", async () => {
    const { call } = await setup();
    const res = await call(png(10, 10), "?purpose=zzz");
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("BAD_PURPOSE");
  });

  it("renvoie 404 sans eventId ou pour un evenement d'une autre organisation", async () => {
    const { call } = await setup();
    expect((await call(png(136, 136), "?purpose=banner")).status).toBe(404);
    const other = await makeEvent((await prisma.organization.create({ data: { name: "X", slug: `x-${Date.now()}` } })).id);
    expect((await call(png(136, 136), `?purpose=logo&eventId=${other.id}`)).status).toBe(404);
  });

  it("sans usage, accepte toujours un PNG 1x1", async () => {
    const { call } = await setup();
    expect((await call(png(1, 1), "")).status).toBe(200);
  });
});
