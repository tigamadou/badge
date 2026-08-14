import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureReferenceTemplates, defaultTemplateId, familyTemplateId } from "@/lib/badge-templates/install";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

// Tests Plan v2-12 : PATCH platformSettings.badgeTemplateId. requireStaff STAFF_ADMIN.
// Racine de la cascade -- NOT NULL en BDD ; null refuse par Zod.

type StaffRoleStr = "SUPER_ADMIN" | "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_OBSERVER";

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

async function makeStaff(staffRole: StaffRoleStr) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const user = await prisma.user.create({
    data: {
      email: `staff-${suffix}@v2-12.test`,
      password: "x",
      name: "Staff User",
      isStaff: true,
      staffRole,
      emailVerifiedAt: new Date(),
    },
  });
  withSession({ id: user.id, email: user.email, name: user.name, isStaff: true });
  return user;
}

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/platform/settings/badge", {
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

describe("PATCH /api/platform/settings/badge", () => {
  beforeEach(async () => {
    vi.mocked(getServerSession).mockReset();
    await setupPlatform();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const { PATCH } = await import("../route");
    const req = makeReq({ badgeTemplateId: await installedDefaultId() });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for STAFF_OBSERVER (below STAFF_ADMIN)", async () => {
    await makeStaff("STAFF_OBSERVER");
    const { PATCH } = await import("../route");
    const req = makeReq({ badgeTemplateId: await installedDefaultId() });
    const res = await PATCH(req);
    expect(res.status).toBe(403);
  });

  it("STAFF_ADMIN updates with valid templateId -> persist + log PLATFORM_SETTINGS_UPDATED", async () => {
    const admin = await makeStaff("STAFF_ADMIN");
    const { PATCH } = await import("../route");
    const req = makeReq({ badgeTemplateId: await installedRectoVersoId() });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.badgeTemplateId).toBe(await installedRectoVersoId());

    const reloaded = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
    });
    expect(reloaded?.badgeTemplateId).toBe(await installedRectoVersoId());

    const log = await prisma.activityLog.findFirst({
      where: { type: "PLATFORM_SETTINGS_UPDATED", userId: admin.id },
    });
    expect(log).not.toBeNull();
    const details = log?.details as { field: string; value: string };
    expect(details.field).toBe("badgeTemplateId");
    expect(details.value).toBe(await installedRectoVersoId());
  });

  it("STAFF_ADMIN with null body -> 400 INVALID_BODY (NOT NULL enforced by Zod)", async () => {
    await makeStaff("STAFF_ADMIN");
    const { PATCH } = await import("../route");
    const req = makeReq({ badgeTemplateId: null });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_BODY");

    const reloaded = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
    });
    // Inchange.
    expect(reloaded?.badgeTemplateId).toBe(await installedDefaultId());
  });

  it("STAFF_ADMIN with unknown templateId -> 400 UNKNOWN_TEMPLATE", async () => {
    await makeStaff("STAFF_ADMIN");
    const { PATCH } = await import("../route");
    const req = makeReq({ badgeTemplateId: "ghost-xyz" });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("UNKNOWN_TEMPLATE");

    const reloaded = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
    });
    expect(reloaded?.badgeTemplateId).toBe(await installedDefaultId());
  });

  it("returns 400 INVALID_BODY for a malformed JSON body", async () => {
    await makeStaff("STAFF_ADMIN");
    const { PATCH } = await import("../route");
    const req = new NextRequest("http://localhost/api/platform/settings/badge", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_BODY");
  });

  it("rethrows a non-AuthError raised while checking the staff role", async () => {
    await makeStaff("STAFF_ADMIN");
    const spy = vi
      .spyOn(prisma.user, "findUnique")
      .mockRejectedValueOnce(new Error("boom-badge-role"));
    const { PATCH } = await import("../route");
    const req = makeReq({ badgeTemplateId: await installedDefaultId() });
    await expect(PATCH(req)).rejects.toThrow("boom-badge-role");
    spy.mockRestore();
  });
});
