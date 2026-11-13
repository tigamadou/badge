import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_RIGHTS } from "@/lib/subscription-rights";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { makeStaff as createStaff } from "@/test/factories";

// Tests Plan v2-14 Task 1 : PATCH /api/platform/settings -- garde SUPER_ADMIN sur
// smtpPassword et recaptchaSecretKey (ADR 2026-06-01 operator-approve-permissions
// / secrets-platform-scope). Les autres champs restent accessibles a STAFF_ADMIN.

type StaffRoleStr = "SUPER_ADMIN" | "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_OBSERVER";

function withSession(user: {
  id: string;
  email: string;
  name: string;
  isStaff: boolean;
}) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

async function setupPlatform(
  overrides: Partial<{
    smtpPassword: string;
    recaptchaSecretKey: string;
  }> = {},
) {
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    update: {
      smtpHost: "mailpit",
      smtpPort: 1025,
      smtpFrom: "noreply@badge.local",
      smtpUser: "",
      smtpPassword: overrides.smtpPassword ?? "preexisting-secret",
      smtpSecure: false,
      recaptchaEnabled: false,
      recaptchaSiteKey: "",
      recaptchaSecretKey: overrides.recaptchaSecretKey ?? "preexisting-recap",
      badgeTemplateId: "default-v1",
    },
    create: {
      id: "singleton",
      smtpHost: "mailpit",
      smtpPort: 1025,
      smtpFrom: "noreply@badge.local",
      smtpUser: "",
      smtpPassword: overrides.smtpPassword ?? "preexisting-secret",
      smtpSecure: false,
      recaptchaEnabled: false,
      recaptchaSiteKey: "",
      recaptchaSecretKey: overrides.recaptchaSecretKey ?? "preexisting-recap",
      badgeTemplateId: "default-v1",
    },
  });
}

async function makeStaff(staffRole: StaffRoleStr) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const user = await createStaff(staffRole, { emailVerifiedAt: new Date() });
  withSession({ id: user.id, email: user.email, name: user.name, isStaff: true });
  return user;
}

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/platform/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("PATCH /api/platform/settings", () => {
  beforeEach(async () => {
    vi.mocked(getServerSession).mockReset();
    await setupPlatform();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const { PATCH } = await import("../route");
    const req = makeReq({ smtpHost: "smtp.example.com" });
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for STAFF_OBSERVER (no settings update permission)", async () => {
    await makeStaff("STAFF_OBSERVER");
    const { PATCH } = await import("../route");
    const req = makeReq({ smtpHost: "smtp.example.com" });
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("STAFF_ADMIN can update non-secret fields (smtpHost)", async () => {
    const admin = await makeStaff("STAFF_ADMIN");
    const { PATCH } = await import("../route");
    const req = makeReq({ smtpHost: "smtp.example.com" });
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);

    const reloaded = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
    });
    expect(reloaded?.smtpHost).toBe("smtp.example.com");
    // Le secret existant n'est pas touche.
    expect(reloaded?.smtpPassword).toBe("preexisting-secret");

    const log = await prisma.activityLog.findFirst({
      where: { type: "PLATFORM_SETTINGS_UPDATED", userId: admin.id },
    });
    expect(log).not.toBeNull();
  });

  it("STAFF_ADMIN with smtpPassword non-empty -> 403 FORBIDDEN_SECRET_CHANGE", async () => {
    await makeStaff("STAFF_ADMIN");
    const { PATCH } = await import("../route");
    const req = makeReq({ smtpPassword: "new-secret" });
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("FORBIDDEN_SECRET_CHANGE");

    const reloaded = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
    });
    expect(reloaded?.smtpPassword).toBe("preexisting-secret");
  });

  it("STAFF_ADMIN with recaptchaSecretKey non-empty -> 403 FORBIDDEN_SECRET_CHANGE", async () => {
    await makeStaff("STAFF_ADMIN");
    const { PATCH } = await import("../route");
    const req = makeReq({ recaptchaSecretKey: "new-recap" });
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("FORBIDDEN_SECRET_CHANGE");

    const reloaded = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
    });
    expect(reloaded?.recaptchaSecretKey).toBe("preexisting-recap");
  });

  it("STAFF_ADMIN with smtpPassword empty string -> 200 (no-op, ignored)", async () => {
    await makeStaff("STAFF_ADMIN");
    const { PATCH } = await import("../route");
    const req = makeReq({ smtpHost: "smtp.example.com", smtpPassword: "" });
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);

    const reloaded = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
    });
    // smtpHost mis a jour, smtpPassword inchange.
    expect(reloaded?.smtpHost).toBe("smtp.example.com");
    expect(reloaded?.smtpPassword).toBe("preexisting-secret");
  });

  it("SUPER_ADMIN can update smtpPassword", async () => {
    const admin = await makeStaff("SUPER_ADMIN");
    const { PATCH } = await import("../route");
    const req = makeReq({ smtpPassword: "rotated-secret" });
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);

    const reloaded = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
    });
    expect(reloaded?.smtpPassword).toBe("rotated-secret");

    const log = await prisma.activityLog.findFirst({
      where: { type: "PLATFORM_SETTINGS_UPDATED", userId: admin.id },
    });
    expect(log).not.toBeNull();
    const details = log?.details as {
      smtpPasswordChanged: boolean;
      recaptchaSecretKeyChanged: boolean;
    };
    expect(details.smtpPasswordChanged).toBe(true);
  });

  it("SUPER_ADMIN can update recaptchaSecretKey", async () => {
    await makeStaff("SUPER_ADMIN");
    const { PATCH } = await import("../route");
    const req = makeReq({ recaptchaSecretKey: "rotated-recap" });
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);

    const reloaded = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
    });
    expect(reloaded?.recaptchaSecretKey).toBe("rotated-recap");
  });

  it("SUPER_ADMIN can update both secrets at once", async () => {
    await makeStaff("SUPER_ADMIN");
    const { PATCH } = await import("../route");
    const req = makeReq({
      smtpPassword: "new-pass",
      recaptchaSecretKey: "new-recap",
    });
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);

    const reloaded = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
    });
    expect(reloaded?.smtpPassword).toBe("new-pass");
    expect(reloaded?.recaptchaSecretKey).toBe("new-recap");
  });

  it("rejects unknown field (Zod strict)", async () => {
    await makeStaff("STAFF_ADMIN");
    const { PATCH } = await import("../route");
    const req = makeReq({ smtpHost: "smtp.example.com", evilField: "x" });
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it("rejects empty body -> 400 NOTHING_TO_UPDATE", async () => {
    await makeStaff("STAFF_ADMIN");
    const { PATCH } = await import("../route");
    const req = makeReq({});
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("NOTHING_TO_UPDATE");
  });

  describe("subscriptionRights", () => {
    const valid = {
      CREATE_EVENT: { active: true, inactive: true },
      RECEIVE_REGISTRATIONS: { active: true, inactive: true },
      MANAGE_ONGOING_EVENTS: { active: true, inactive: false },
      ACCESS_ORG_SPACE: { active: true, inactive: false },
    };

    it("STAFF_ADMIN enregistre une matrice valide et journalise", async () => {
      const admin = await makeStaff("STAFF_ADMIN");
      const { PATCH } = await import("../route");
      const res = await PATCH(makeReq({ subscriptionRights: valid }), { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.settings.subscriptionRights).toEqual(valid);

      const reloaded = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
      expect(reloaded?.subscriptionRights).toEqual(valid);
      const log = await prisma.activityLog.findFirst({
        where: { type: "PLATFORM_SETTINGS_UPDATED", userId: admin.id },
      });
      expect(log).not.toBeNull();
      expect((log?.details as { changedFields: string[] }).changedFields).toContain("subscriptionRights");
    });

    it("clé inconnue -> 400 VALIDATION", async () => {
      await makeStaff("STAFF_ADMIN");
      const { PATCH } = await import("../route");
      const res = await PATCH(
        makeReq({ subscriptionRights: { ...valid, FOO: { active: true, inactive: true } } }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("VALIDATION");
    });

    it("valeur non booléenne -> 400 VALIDATION", async () => {
      await makeStaff("STAFF_ADMIN");
      const { PATCH } = await import("../route");
      const res = await PATCH(
        makeReq({ subscriptionRights: { ...valid, CREATE_EVENT: { active: "oui", inactive: true } } }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("VALIDATION");
    });

    it("droit manquant -> 400 VALIDATION", async () => {
      await makeStaff("STAFF_ADMIN");
      const { PATCH } = await import("../route");
      const { ACCESS_ORG_SPACE: _omit, ...partial } = valid;
      void _omit;
      const res = await PATCH(makeReq({ subscriptionRights: partial }), { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
    });

    it("STAFF_SUPPORT -> 403", async () => {
      await makeStaff("STAFF_SUPPORT");
      const { PATCH } = await import("../route");
      const res = await PATCH(makeReq({ subscriptionRights: valid }), { params: Promise.resolve({}) });
      expect(res.status).toBe(403);
    });

    it("un PATCH sans subscriptionRights laisse la matrice inchangée", async () => {
      const admin = await makeStaff("STAFF_ADMIN");
      await prisma.platformSettings.update({
        where: { id: "singleton" },
        data: { subscriptionRights: valid },
      });
      const { PATCH } = await import("../route");
      const res = await PATCH(makeReq({ smtpHost: "x" }), { params: Promise.resolve({}) });
      expect(res.status).toBe(200);

      const reloaded = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
      expect(reloaded?.subscriptionRights).toEqual(valid);
      const log = await prisma.activityLog.findFirst({
        where: { type: "PLATFORM_SETTINGS_UPDATED", userId: admin.id },
      });
      const changed = (log?.details as { changedFields: string[] }).changedFields;
      expect(changed).toContain("smtpHost");
      expect(changed).not.toContain("subscriptionRights");
    });

    it("GET sans valeur enregistrée renvoie les défauts", async () => {
      await makeStaff("STAFF_OBSERVER");
      await prisma.platformSettings.update({
        where: { id: "singleton" },
        data: { subscriptionRights: Prisma.DbNull },
      });
      const { GET } = await import("../route");
      const res = await GET(
        new NextRequest("http://localhost/api/platform/settings"),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(200);
      expect((await res.json()).settings.subscriptionRights).toEqual(DEFAULT_RIGHTS);
    });
  });
});
