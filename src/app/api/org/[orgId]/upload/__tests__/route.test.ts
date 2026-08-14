import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

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

function makeReq(orgId: string, file?: { name: string; type: string; bytes: Buffer }): NextRequest {
  const fd = new FormData();
  if (file) {
    const ab = new ArrayBuffer(file.bytes.byteLength);
    new Uint8Array(ab).set(file.bytes);
    fd.append("file", new Blob([ab], { type: file.type }), file.name);
  }
  return new NextRequest(`http://localhost/api/org/${orgId}/upload`, { method: "POST", body: fd });
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
