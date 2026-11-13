import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

// Plan 6 : sendSmtpTest envoie reellement via nodemailer. Les tests d'API ne doivent
// pas faire de vrai I/O SMTP — on le bouchonne ici pour valider la route uniquement.
vi.mock("@/lib/mail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mail")>();
  return { ...actual, sendSmtpTest: vi.fn(async () => undefined) };
});
import { sendSmtpTest } from "@/lib/mail";
import { makeStaff as createStaff } from "@/test/factories";

type StaffRoleStr = "SUPER_ADMIN" | "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_OBSERVER";

function withSession(user: {
  id: string;
  email: string;
  name: string;
  isStaff: boolean;
}) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

async function makeStaff(staffRole: StaffRoleStr = "STAFF_ADMIN") {
  // Email valide (regex sendSmtpTest exige `*@*.*`) pour permettre le fallback
  // session.user.email lors du test test-smtp sans body.to.
  const u = await createStaff(staffRole);
  withSession({ id: u.id, email: u.email, name: u.name, isStaff: true });
  return u;
}

async function cleanDb() {
  await prisma.activityLog.deleteMany();
  await prisma.platformSettings.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.orgMembership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
}

async function seedSettings(overrides: Partial<{
  smtpHost: string;
  smtpPort: number;
  smtpFrom: string;
  smtpUser: string;
  smtpPassword: string;
  smtpSecure: boolean;
  recaptchaEnabled: boolean;
  recaptchaSiteKey: string;
  recaptchaSecretKey: string;
}> = {}) {
  return prisma.platformSettings.create({
    data: {
      id: "singleton",
      smtpHost: "smtp.old",
      smtpPort: 25,
      smtpFrom: "old@x.test",
      smtpUser: "",
      smtpPassword: "",
      smtpSecure: false,
      recaptchaEnabled: false,
      recaptchaSiteKey: "",
      recaptchaSecretKey: "",
      ...overrides,
    },
  });
}

// =====================================================
//  GET /api/platform/settings
// =====================================================

describe("GET /api/platform/settings", () => {
  beforeEach(async () => {
    await cleanDb();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const { GET } = await import("@/app/api/platform/settings/route");
    const req = new NextRequest("http://localhost/api/platform/settings");
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-staff", async () => {
    const u = await prisma.user.create({
      data: { email: "c@x", password: "x", name: "C" },
    });
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const { GET } = await import("@/app/api/platform/settings/route");
    const req = new NextRequest("http://localhost/api/platform/settings");
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("STAFF_OBSERVER can read; never exposes smtpPassword nor recaptchaSecretKey", async () => {
    await makeStaff("STAFF_OBSERVER");
    await seedSettings({
      smtpHost: "h",
      smtpPort: 587,
      smtpFrom: "f@x.test",
      smtpUser: "u",
      smtpPassword: "SUPER_SECRET",
      smtpSecure: false,
      recaptchaEnabled: true,
      recaptchaSiteKey: "site",
      recaptchaSecretKey: "ANOTHER_SECRET",
    });

    const { GET } = await import("@/app/api/platform/settings/route");
    const req = new NextRequest("http://localhost/api/platform/settings");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.settings.smtpPassword).toBeUndefined();
    expect(json.settings.recaptchaSecretKey).toBeUndefined();
    expect(json.settings.smtpPasswordSet).toBe(true);
    expect(json.settings.recaptchaSecretKeySet).toBe(true);
    expect(json.settings.smtpHost).toBe("h");
    expect(json.settings.recaptchaSiteKey).toBe("site");

    const dump = JSON.stringify(json);
    expect(dump).not.toContain("SUPER_SECRET");
    expect(dump).not.toContain("ANOTHER_SECRET");
  });

  it("creates a singleton on the fly when missing", async () => {
    await makeStaff("STAFF_OBSERVER");

    const { GET } = await import("@/app/api/platform/settings/route");
    const req = new NextRequest("http://localhost/api/platform/settings");
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.settings.smtpPasswordSet).toBe(false);
    expect(json.settings.recaptchaSecretKeySet).toBe(false);

    const reloaded = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
    });
    expect(reloaded).not.toBeNull();
  });
});

// =====================================================
//  PATCH /api/platform/settings
// =====================================================

describe("PATCH /api/platform/settings", () => {
  beforeEach(async () => {
    await cleanDb();
    vi.mocked(getServerSession).mockReset();
    await seedSettings();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/platform/settings/route");
    const req = new NextRequest("http://localhost/api/platform/settings", {
      method: "PATCH",
      body: JSON.stringify({ smtpHost: "new" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("STAFF_OBSERVER cannot patch (403)", async () => {
    await makeStaff("STAFF_OBSERVER");
    const { PATCH } = await import("@/app/api/platform/settings/route");
    const req = new NextRequest("http://localhost/api/platform/settings", {
      method: "PATCH",
      body: JSON.stringify({ smtpHost: "new" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("STAFF_SUPPORT cannot patch (403)", async () => {
    await makeStaff("STAFF_SUPPORT");
    const { PATCH } = await import("@/app/api/platform/settings/route");
    const req = new NextRequest("http://localhost/api/platform/settings", {
      method: "PATCH",
      body: JSON.stringify({ smtpHost: "new" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  // ADR 2026-06-01 (v2-14 Task 1) : ecriture des secrets reservee a SUPER_ADMIN.
  // Test rebascule en SUPER_ADMIN pour preserver la verification end-to-end de l'audit
  // log sans valeurs secretes.
  it("SUPER_ADMIN updates SMTP + reCAPTCHA fields, logs PLATFORM_SETTINGS_UPDATED without secret values", async () => {
    await makeStaff("SUPER_ADMIN");
    const { PATCH } = await import("@/app/api/platform/settings/route");
    const req = new NextRequest("http://localhost/api/platform/settings", {
      method: "PATCH",
      body: JSON.stringify({
        smtpHost: "smtp.new",
        smtpPort: 465,
        smtpFrom: "new@x.test",
        smtpUser: "newuser",
        smtpPassword: "NEW_PWD_SECRET",
        smtpSecure: true,
        recaptchaEnabled: true,
        recaptchaSiteKey: "site-new",
        recaptchaSecretKey: "NEW_RECAPTCHA_SECRET",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const json = await res.json();

    // La reponse PATCH renvoie la vue publique (sans secrets).
    expect(json.settings.smtpPassword).toBeUndefined();
    expect(json.settings.recaptchaSecretKey).toBeUndefined();
    expect(json.settings.smtpPasswordSet).toBe(true);
    expect(json.settings.recaptchaSecretKeySet).toBe(true);
    expect(JSON.stringify(json)).not.toContain("NEW_PWD_SECRET");
    expect(JSON.stringify(json)).not.toContain("NEW_RECAPTCHA_SECRET");

    // Persistance en base.
    const reloaded = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
    });
    expect(reloaded?.smtpHost).toBe("smtp.new");
    expect(reloaded?.smtpPort).toBe(465);
    expect(reloaded?.smtpPassword).toBe("NEW_PWD_SECRET");
    expect(reloaded?.recaptchaSecretKey).toBe("NEW_RECAPTCHA_SECRET");
    expect(reloaded?.recaptchaEnabled).toBe(true);

    // Log d'audit : pas de valeur secrete, mais les booleans *Changed sont a true.
    const log = await prisma.activityLog.findFirst({
      where: { type: "PLATFORM_SETTINGS_UPDATED" },
    });
    expect(log).not.toBeNull();
    const dump = JSON.stringify(log?.details);
    expect(dump).not.toContain("NEW_PWD_SECRET");
    expect(dump).not.toContain("NEW_RECAPTCHA_SECRET");
    const details = log?.details as {
      smtpPasswordChanged: boolean;
      recaptchaSecretKeyChanged: boolean;
      changedFields: string[];
    };
    expect(details.smtpPasswordChanged).toBe(true);
    expect(details.recaptchaSecretKeyChanged).toBe(true);
    expect(details.changedFields).toContain("smtpHost");
  });

  it("SUPER_ADMIN can also patch", async () => {
    await makeStaff("SUPER_ADMIN");
    const { PATCH } = await import("@/app/api/platform/settings/route");
    const req = new NextRequest("http://localhost/api/platform/settings", {
      method: "PATCH",
      body: JSON.stringify({ smtpHost: "smtp.super" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
  });

  it("empty smtpPassword preserves existing value (no overwrite with empty)", async () => {
    await cleanDb();
    await seedSettings({ smtpPassword: "EXISTING_PWD" });
    await makeStaff("STAFF_ADMIN");

    const { PATCH } = await import("@/app/api/platform/settings/route");
    const req = new NextRequest("http://localhost/api/platform/settings", {
      method: "PATCH",
      body: JSON.stringify({ smtpHost: "h2", smtpPassword: "" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);

    const reloaded = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
    });
    expect(reloaded?.smtpPassword).toBe("EXISTING_PWD");
    expect(reloaded?.smtpHost).toBe("h2");

    // Log : pas de changement marquant le secret comme modifie.
    const log = await prisma.activityLog.findFirst({
      where: { type: "PLATFORM_SETTINGS_UPDATED" },
      orderBy: { createdAt: "desc" },
    });
    const details = log?.details as { smtpPasswordChanged: boolean };
    expect(details.smtpPasswordChanged).toBe(false);
  });

  it("rejects unknown fields with 400 (strict schema)", async () => {
    await makeStaff("STAFF_ADMIN");
    const { PATCH } = await import("@/app/api/platform/settings/route");
    const req = new NextRequest("http://localhost/api/platform/settings", {
      method: "PATCH",
      body: JSON.stringify({ smtpHost: "h", unknownField: "x" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);

    const reloaded = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
    });
    expect(reloaded?.smtpHost).toBe("smtp.old");
  });

  it("rejects empty body with 400 (NOTHING_TO_UPDATE)", async () => {
    await makeStaff("STAFF_ADMIN");
    const { PATCH } = await import("@/app/api/platform/settings/route");
    const req = new NextRequest("http://localhost/api/platform/settings", {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it("rejects malformed JSON body with 400", async () => {
    await makeStaff("STAFF_ADMIN");
    const { PATCH } = await import("@/app/api/platform/settings/route");
    const req = new NextRequest("http://localhost/api/platform/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });
});

// =====================================================
//  POST /api/platform/settings/test-smtp
// =====================================================

describe("POST /api/platform/settings/test-smtp", () => {
  beforeEach(async () => {
    await cleanDb();
    vi.mocked(getServerSession).mockReset();
    await seedSettings();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const { POST } = await import("@/app/api/platform/settings/test-smtp/route");
    const req = new NextRequest("http://localhost/api/platform/settings/test-smtp", {
      method: "POST",
      body: JSON.stringify({ to: "ok@example.com" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("STAFF_OBSERVER cannot test SMTP (403)", async () => {
    await makeStaff("STAFF_OBSERVER");
    const { POST } = await import("@/app/api/platform/settings/test-smtp/route");
    const req = new NextRequest("http://localhost/api/platform/settings/test-smtp", {
      method: "POST",
      body: JSON.stringify({ to: "ok@example.com" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("STAFF_SUPPORT cannot test SMTP (403)", async () => {
    await makeStaff("STAFF_SUPPORT");
    const { POST } = await import("@/app/api/platform/settings/test-smtp/route");
    const req = new NextRequest("http://localhost/api/platform/settings/test-smtp", {
      method: "POST",
      body: JSON.stringify({ to: "ok@example.com" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("STAFF_ADMIN sends test SMTP to provided email (200)", async () => {
    await makeStaff("STAFF_ADMIN");
    const { POST } = await import("@/app/api/platform/settings/test-smtp/route");
    const req = new NextRequest("http://localhost/api/platform/settings/test-smtp", {
      method: "POST",
      body: JSON.stringify({ to: "target@example.com" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.to).toBe("target@example.com");
  });

  it("STAFF_ADMIN falls back to own session email when no body.to", async () => {
    const admin = await makeStaff("STAFF_ADMIN");
    const { POST } = await import("@/app/api/platform/settings/test-smtp/route");
    const req = new NextRequest("http://localhost/api/platform/settings/test-smtp", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.to).toBe(admin.email);
  });

  it("returns 400 for invalid email format", async () => {
    await makeStaff("STAFF_ADMIN");
    const { POST } = await import("@/app/api/platform/settings/test-smtp/route");
    const req = new NextRequest("http://localhost/api/platform/settings/test-smtp", {
      method: "POST",
      body: JSON.stringify({ to: "not-an-email" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it("treats a malformed JSON body as {} (falls back to session email)", async () => {
    const admin = await makeStaff("STAFF_ADMIN");
    const { POST } = await import("@/app/api/platform/settings/test-smtp/route");
    const req = new NextRequest("http://localhost/api/platform/settings/test-smtp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.to).toBe(admin.email);
  });

  it("treats a JSON `null` body as {} (nullish fallback, falls back to session email)", async () => {
    const admin = await makeStaff("STAFF_ADMIN");
    const { POST } = await import("@/app/api/platform/settings/test-smtp/route");
    const req = new NextRequest("http://localhost/api/platform/settings/test-smtp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "null",
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.to).toBe(admin.email);
  });

  it("returns 400 NO_EMAIL_PROVIDED when no `to` is given and the session has no email", async () => {
    const admin = await makeStaff("STAFF_ADMIN");
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: admin.id, email: "", name: admin.name, isStaff: true },
    } as never);
    const { POST } = await import("@/app/api/platform/settings/test-smtp/route");
    const req = new NextRequest("http://localhost/api/platform/settings/test-smtp", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("NO_EMAIL_PROVIDED");
  });

  it("returns 400 INVALID_EMAIL and logs ok:false when sendSmtpTest rejects with an invalid-email message", async () => {
    const admin = await makeStaff("STAFF_ADMIN");
    // `to` doit passer la validation zod (.email()) de la route : c'est sendSmtpTest
    // (mocke) qui rejette ensuite avec un message "invalid email", pas le schema.
    vi.mocked(sendSmtpTest).mockRejectedValueOnce(
      new Error("Invalid email address: someone@example.com"),
    );
    const { POST } = await import("@/app/api/platform/settings/test-smtp/route");
    const req = new NextRequest("http://localhost/api/platform/settings/test-smtp", {
      method: "POST",
      body: JSON.stringify({ to: "someone@example.com" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_EMAIL");

    const log = await prisma.activityLog.findFirst({
      where: { type: "PLATFORM_SETTINGS_UPDATED", userId: admin.id },
      orderBy: { createdAt: "desc" },
    });
    expect(log).not.toBeNull();
    const details = log?.details as { action: string; ok: boolean; message: string };
    expect(details.action).toBe("test-smtp");
    expect(details.ok).toBe(false);
  });

  it("returns 500 SMTP_TEST_FAILED with message 'unknown' when sendSmtpTest rejects a non-Error value", async () => {
    const admin = await makeStaff("STAFF_ADMIN");
    vi.mocked(sendSmtpTest).mockRejectedValueOnce("boom-string");
    const { POST } = await import("@/app/api/platform/settings/test-smtp/route");
    const req = new NextRequest("http://localhost/api/platform/settings/test-smtp", {
      method: "POST",
      body: JSON.stringify({ to: "target@example.com" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("SMTP_TEST_FAILED");
    expect(json.message).toBe("unknown");

    const log = await prisma.activityLog.findFirst({
      where: { type: "PLATFORM_SETTINGS_UPDATED", userId: admin.id },
      orderBy: { createdAt: "desc" },
    });
    const details = log?.details as { message: string };
    expect(details.message).toBe("unknown");
  });

  it("returns 500 SMTP_TEST_FAILED and logs ok:false for a generic SMTP failure", async () => {
    const admin = await makeStaff("STAFF_ADMIN");
    vi.mocked(sendSmtpTest).mockRejectedValueOnce(new Error("Connection refused"));
    const { POST } = await import("@/app/api/platform/settings/test-smtp/route");
    const req = new NextRequest("http://localhost/api/platform/settings/test-smtp", {
      method: "POST",
      body: JSON.stringify({ to: "target@example.com" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("SMTP_TEST_FAILED");

    const log = await prisma.activityLog.findFirst({
      where: { type: "PLATFORM_SETTINGS_UPDATED", userId: admin.id },
      orderBy: { createdAt: "desc" },
    });
    expect(log).not.toBeNull();
    const details = log?.details as { ok: boolean; message: string };
    expect(details.ok).toBe(false);
    expect(details.message).toBe("Connection refused");
  });
});
