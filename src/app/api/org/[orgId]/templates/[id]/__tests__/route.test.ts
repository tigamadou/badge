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

describe("PATCH /api/org/[orgId]/templates/[id]", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.categoryTemplate.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { PATCH } = await import("@/app/api/org/[orgId]/templates/[id]/route");
    const req = new NextRequest("http://localhost/api/org/x/templates/y", {
      method: "PATCH",
      body: JSON.stringify({ name: "New" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: "x", id: "y" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for AUDITOR (below MANAGER)", async () => {
    const { org } = await seedOrgWithMember("AUDITOR");
    const tpl = await prisma.categoryTemplate.create({
      data: { orgId: org.id, name: "T", color: "#000000", number: 1 },
    });

    const { PATCH } = await import("@/app/api/org/[orgId]/templates/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/templates/${tpl.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "New" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, id: tpl.id }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 for an invalid color", async () => {
    const { org } = await seedOrgWithMember("MANAGER");
    const tpl = await prisma.categoryTemplate.create({
      data: { orgId: org.id, name: "T", color: "#000000", number: 1 },
    });

    const { PATCH } = await import("@/app/api/org/[orgId]/templates/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/templates/${tpl.id}`, {
      method: "PATCH",
      body: JSON.stringify({ color: "red" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, id: tpl.id }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the template belongs to another org", async () => {
    const { org: orgA } = await seedOrgWithMember("MANAGER");
    const orgB = await prisma.organization.create({ data: { name: "OB", slug: `ob-${Date.now()}` } });
    const tpl = await prisma.categoryTemplate.create({
      data: { orgId: orgB.id, name: "T", color: "#000000", number: 1 },
    });

    const { PATCH } = await import("@/app/api/org/[orgId]/templates/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${orgA.id}/templates/${tpl.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "New" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: orgA.id, id: tpl.id }) });
    expect(res.status).toBe(404);
  });

  it("returns 404 when the template id does not exist", async () => {
    const { org } = await seedOrgWithMember("MANAGER");

    const { PATCH } = await import("@/app/api/org/[orgId]/templates/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/templates/does-not-exist`, {
      method: "PATCH",
      body: JSON.stringify({ name: "New" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, id: "does-not-exist" }) });
    expect(res.status).toBe(404);
  });

  it("updates the template and logs CATEGORY_TEMPLATE_UPDATED", async () => {
    const { u, org } = await seedOrgWithMember("MANAGER");
    const tpl = await prisma.categoryTemplate.create({
      data: { orgId: org.id, name: "Old", color: "#000000", number: 1 },
    });

    const { PATCH } = await import("@/app/api/org/[orgId]/templates/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/templates/${tpl.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: "New",
        color: "#ffffff",
        number: 2,
        neutralBadge: true,
        anonymous: true,
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, id: tpl.id }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.template.name).toBe("New");
    expect(json.template.neutralBadge).toBe(true);

    const log = await prisma.activityLog.findFirst({
      where: { type: "CATEGORY_TEMPLATE_UPDATED", targetId: tpl.id, userId: u.id },
    });
    expect(log).not.toBeNull();
  });

  it("rethrows a non-AuthError from requirePermission", async () => {
    const { org } = await seedOrgWithMember("MANAGER");
    const tpl = await prisma.categoryTemplate.create({
      data: { orgId: org.id, name: "T", color: "#000000", number: 1 },
    });

    const spy = vi.spyOn(prisma.user, "findUnique").mockRejectedValueOnce(new Error("db boom"));

    const { PATCH } = await import("@/app/api/org/[orgId]/templates/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/templates/${tpl.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "New" }),
      headers: { "content-type": "application/json" },
    });
    await expect(
      PATCH(req, { params: Promise.resolve({ orgId: org.id, id: tpl.id }) }),
    ).rejects.toThrow("db boom");
    spy.mockRestore();
  });

  it("returns 400 VALIDATION for a malformed JSON body", async () => {
    const { org } = await seedOrgWithMember("MANAGER");
    const tpl = await prisma.categoryTemplate.create({
      data: { orgId: org.id, name: "T", color: "#000000", number: 1 },
    });

    const { PATCH } = await import("@/app/api/org/[orgId]/templates/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/templates/${tpl.id}`, {
      method: "PATCH",
      body: "{not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, id: tpl.id }) });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/org/[orgId]/templates/[id]", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.categoryTemplate.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { DELETE } = await import("@/app/api/org/[orgId]/templates/[id]/route");
    const req = new NextRequest("http://localhost/api/org/x/templates/y", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ orgId: "x", id: "y" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for AUDITOR (below MANAGER)", async () => {
    const { org } = await seedOrgWithMember("AUDITOR");
    const tpl = await prisma.categoryTemplate.create({
      data: { orgId: org.id, name: "T", color: "#000000", number: 1 },
    });

    const { DELETE } = await import("@/app/api/org/[orgId]/templates/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/templates/${tpl.id}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ orgId: org.id, id: tpl.id }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the template belongs to another org", async () => {
    const { org: orgA } = await seedOrgWithMember("MANAGER");
    const orgB = await prisma.organization.create({ data: { name: "OB", slug: `ob-del-${Date.now()}` } });
    const tpl = await prisma.categoryTemplate.create({
      data: { orgId: orgB.id, name: "T", color: "#000000", number: 1 },
    });

    const { DELETE } = await import("@/app/api/org/[orgId]/templates/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${orgA.id}/templates/${tpl.id}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ orgId: orgA.id, id: tpl.id }) });
    expect(res.status).toBe(404);
  });

  it("deletes the template and logs CATEGORY_TEMPLATE_DELETED", async () => {
    const { u, org } = await seedOrgWithMember("MANAGER");
    const tpl = await prisma.categoryTemplate.create({
      data: { orgId: org.id, name: "ToDelete", color: "#000000", number: 1 },
    });

    const { DELETE } = await import("@/app/api/org/[orgId]/templates/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/templates/${tpl.id}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ orgId: org.id, id: tpl.id }) });
    expect(res.status).toBe(204);

    const remaining = await prisma.categoryTemplate.findUnique({ where: { id: tpl.id } });
    expect(remaining).toBeNull();

    const log = await prisma.activityLog.findFirst({
      where: { type: "CATEGORY_TEMPLATE_DELETED", targetId: tpl.id, userId: u.id },
    });
    expect(log).not.toBeNull();
    expect((log?.details as { name?: string })?.name).toBe("ToDelete");
  });
});
