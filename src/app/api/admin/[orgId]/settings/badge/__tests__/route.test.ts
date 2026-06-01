import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

// Tests Plan v2-12 : PATCH organization.badgeTemplateId. requireOrgRole MANAGER
// (OWNER satisfait via hierarchie). Log via ORG_UPDATED.

type OrgRoleStr = "OWNER" | "MANAGER" | "AUDITOR";

function withSession(user: {
  id: string;
  email: string;
  name: string;
  isStaff: boolean;
}) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

async function setupPlatform() {
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    update: { badgeTemplateId: "default-v1" },
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
      badgeTemplateId: "default-v1",
    },
  });
}

async function makeOrgWithMember(orgRole: OrgRoleStr) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const user = await prisma.user.create({
    data: {
      email: `org-${suffix}@v2-12.test`,
      password: "x",
      name: "Org User",
      isStaff: false,
      emailVerifiedAt: new Date(),
    },
  });
  const org = await prisma.organization.create({
    data: { name: `Org ${suffix}`, slug: `org-${suffix}` },
  });
  await prisma.orgMembership.create({
    data: { userId: user.id, orgId: org.id, role: orgRole },
  });
  withSession({ id: user.id, email: user.email, name: user.name, isStaff: false });
  return { user, org };
}

function makeReq(orgId: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/admin/${orgId}/settings/badge`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("PATCH /api/admin/[orgId]/settings/badge", () => {
  beforeEach(async () => {
    vi.mocked(getServerSession).mockReset();
    await setupPlatform();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const org = await prisma.organization.create({
      data: { name: "Org401", slug: `org-401-${Date.now()}` },
    });
    const { PATCH } = await import("../route");
    const req = makeReq(org.id, { badgeTemplateId: "default-v1" });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for AUDITOR (below MANAGER)", async () => {
    const { org } = await makeOrgWithMember("AUDITOR");
    const { PATCH } = await import("../route");
    const req = makeReq(org.id, { badgeTemplateId: "default-v1" });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(403);
  });

  it("MANAGER updates with valid templateId -> persist on Organization + log ORG_UPDATED", async () => {
    const { user, org } = await makeOrgWithMember("MANAGER");
    const { PATCH } = await import("../route");
    const req = makeReq(org.id, { badgeTemplateId: "recto-verso-v1" });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.badgeTemplateId).toBe("recto-verso-v1");

    const reloaded = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(reloaded?.badgeTemplateId).toBe("recto-verso-v1");

    const log = await prisma.activityLog.findFirst({
      where: { type: "ORG_UPDATED", userId: user.id, orgId: org.id },
    });
    expect(log).not.toBeNull();
    const details = log?.details as { field: string; value: string | null };
    expect(details.field).toBe("badgeTemplateId");
    expect(details.value).toBe("recto-verso-v1");
  });

  it("OWNER updates with null -> persist null (heritage platform)", async () => {
    const { user, org } = await makeOrgWithMember("OWNER");
    await prisma.organization.update({
      where: { id: org.id },
      data: { badgeTemplateId: "recto-verso-v1" },
    });

    const { PATCH } = await import("../route");
    const req = makeReq(org.id, { badgeTemplateId: null });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.badgeTemplateId).toBeNull();

    const reloaded = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(reloaded?.badgeTemplateId).toBeNull();

    const log = await prisma.activityLog.findFirst({
      where: { type: "ORG_UPDATED", userId: user.id, orgId: org.id },
    });
    expect(log).not.toBeNull();
    const details = log?.details as { value: string | null };
    expect(details.value).toBeNull();
  });

  it("MANAGER with unknown templateId -> 400 UNKNOWN_TEMPLATE", async () => {
    const { org } = await makeOrgWithMember("MANAGER");
    const { PATCH } = await import("../route");
    const req = makeReq(org.id, { badgeTemplateId: "ghost-xyz" });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("UNKNOWN_TEMPLATE");

    const reloaded = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(reloaded?.badgeTemplateId).toBeNull();
  });
});
