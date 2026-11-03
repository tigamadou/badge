import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeRequest } from "@/lib/__tests__/helpers/print-requests";
import { ensureReferenceTemplates, defaultTemplateId, familyTemplateId } from "@/lib/badge-templates/install";

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
    update: { badgeTemplateId: await installedDefaultId() },
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
      badgeTemplateId: await installedDefaultId(),
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
  return new NextRequest(`http://localhost/api/org/${orgId}/settings/badge`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

// v4 (plan 12) : les templates livres sont installes en base. Un identifiant valide
// est donc un cuid, plus une chaine litterale.
async function installedDefaultId(): Promise<string> {
  await ensureReferenceTemplates("seed-test");
  return (await defaultTemplateId())!;
}

async function installedRectoVersoId(): Promise<string> {
  await ensureReferenceTemplates("seed-test");
  return (await familyTemplateId("recto-verso"))!;
}

describe("PATCH /api/org/[orgId]/settings/badge", () => {
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
    const req = makeReq(org.id, { badgeTemplateId: await installedDefaultId() });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for AUDITOR (below MANAGER)", async () => {
    const { org } = await makeOrgWithMember("AUDITOR");
    const { PATCH } = await import("../route");
    const req = makeReq(org.id, { badgeTemplateId: await installedDefaultId() });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(403);
  });

  it("MANAGER updates with valid templateId -> persist on Organization + log ORG_UPDATED", async () => {
    const { user, org } = await makeOrgWithMember("MANAGER");
    const { PATCH } = await import("../route");
    const req = makeReq(org.id, { badgeTemplateId: await installedRectoVersoId() });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.badgeTemplateId).toBe(await installedRectoVersoId());

    const reloaded = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(reloaded?.badgeTemplateId).toBe(await installedRectoVersoId());

    const log = await prisma.activityLog.findFirst({
      where: { type: "ORG_UPDATED", userId: user.id, orgId: org.id },
    });
    expect(log).not.toBeNull();
    const details = log?.details as { field: string; value: string | null };
    expect(details.field).toBe("badgeTemplateId");
    expect(details.value).toBe(await installedRectoVersoId());
  });

  it("OWNER updates with null -> persist null (heritage platform)", async () => {
    const { user, org } = await makeOrgWithMember("OWNER");
    await prisma.organization.update({
      where: { id: org.id },
      data: { badgeTemplateId: await installedRectoVersoId() },
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

  it("returns 400 INVALID_BODY for a malformed JSON body", async () => {
    const { org } = await makeOrgWithMember("MANAGER");
    const { PATCH } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/settings/badge`, {
      method: "PATCH",
      body: "{not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_BODY");
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

  it("rethrows a non-AuthError from requireOrgRole", async () => {
    const { org } = await makeOrgWithMember("MANAGER");
    const spy = vi.spyOn(prisma.user, "findUnique").mockRejectedValueOnce(new Error("db boom"));

    const { PATCH } = await import("../route");
    const req = makeReq(org.id, { badgeTemplateId: await installedDefaultId() });
    await expect(PATCH(req, { params: Promise.resolve({ orgId: org.id }) })).rejects.toThrow("db boom");
    spy.mockRestore();
  });
});

describe("PATCH org badge template : évènements verrouillés", () => {
  beforeEach(async () => {
    vi.mocked(getServerSession).mockReset();
    await setupPlatform();
  });

  it("épingle l'évènement verrouillé, suit pour les autres, ignore celui qui a son template", async () => {
    const { user, org } = await makeOrgWithMember("OWNER");
    const defId = await installedDefaultId();
    const rvId = await installedRectoVersoId();
    const mk = (title: string, badgeTemplateId: string | null = null) =>
      prisma.event.create({
        data: { orgId: org.id, title, slug: `${title}-${Date.now()}-${Math.random()}`, location: "X", date: new Date(), badgeTemplateId },
      });
    const [locked, free, own] = [await mk("locked"), await mk("free"), await mk("own", defId)];
    const paid = await makeRequest({ org, event: locked, owner: user }, { status: "PAID", badgeTemplateId: defId });
    const ownPaid = await makeRequest({ org, event: own, owner: user }, { status: "PAID", badgeTemplateId: defId });
    const freeReq = await makeRequest({ org, event: free, owner: user }, { status: "QUOTED", badgeTemplateId: defId });

    const { PATCH } = await import("../route");
    const res = await PATCH(makeReq(org.id, { badgeTemplateId: rvId }), { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);

    const ev = (id: string) => prisma.event.findUniqueOrThrow({ where: { id } });
    expect((await ev(locked.id)).badgeTemplateId).toBe(defId);
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: paid.id } })).templatePinned).toBe(true);
    expect((await ev(free.id)).badgeTemplateId).toBeNull();
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: freeReq.id } })).status).toBe("SUBMITTED");
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: freeReq.id } })).badgeTemplateId).toBe(rvId);
    expect((await ev(own.id)).badgeTemplateId).toBe(defId);
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: ownPaid.id } })).templatePinned).toBe(false);
  });
});
