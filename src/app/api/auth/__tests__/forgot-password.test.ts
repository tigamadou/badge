import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resetRateLimitForTests } from "@/lib/rate-limit";

vi.mock("@/lib/mail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mail")>();
  return {
    ...actual,
    sendAccountVerifyEmail: vi.fn(),
    sendAccountPasswordReset: vi.fn(),
    sendRegistrationConfirmation: vi.fn(),
    sendRegistrationResubmitted: vi.fn(),
    sendStatusNotification: vi.fn(),
    sendBadgePrintedNotification: vi.fn(),
  };
});

vi.mock("@/lib/recaptcha", () => ({
  verifyRecaptcha: vi.fn().mockResolvedValue({ ok: true }),
}));

import { sendAccountPasswordReset } from "@/lib/mail";
import { verifyRecaptcha } from "@/lib/recaptcha";

function makeRawReq(rawBody: string): NextRequest {
  return new NextRequest("http://localhost/api/auth/forgot-password", {
    method: "POST",
    body: rawBody,
    headers: { "content-type": "application/json" },
  });
}

async function seedPlatform() {
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      smtpHost: "localhost",
      smtpPort: 587,
      smtpFrom: "noreply@v2-11-forgot.test",
      smtpUser: "",
      smtpPassword: "",
      smtpSecure: false,
      recaptchaEnabled: false,
      recaptchaSiteKey: "",
      recaptchaSecretKey: "",
    },
    update: { recaptchaEnabled: false },
  });
}

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(async () => {
    resetRateLimitForTests();
    vi.mocked(sendAccountPasswordReset).mockClear();
    await seedPlatform();
  });

  it("verified existing email -> 200 + mail sent + token hash stored + log written", async () => {
    const u = await prisma.user.create({
      data: {
        email: "verified@v2-11-forgot.test",
        password: "x",
        name: "V",
        emailVerifiedAt: new Date(),
      },
    });

    const { POST } = await import("@/app/api/auth/forgot-password/route");
    const res = await POST(makeReq({ email: u.email }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    expect(vi.mocked(sendAccountPasswordReset)).toHaveBeenCalledTimes(1);
    const [userIdArg, plainToken] = vi.mocked(sendAccountPasswordReset).mock.calls[0]!;
    expect(userIdArg).toBe(u.id);
    expect(typeof plainToken).toBe("string");

    const updated = await prisma.user.findUnique({ where: { id: u.id } });
    expect(updated?.passwordResetToken).toBeTruthy();
    expect(updated!.passwordResetToken!.length).toBe(64); // sha256 hex
    expect(updated?.passwordResetToken).not.toBe(plainToken);
    expect(updated?.passwordResetExpiry).toBeInstanceOf(Date);

    const log = await prisma.activityLog.findFirst({
      where: { type: "USER_PASSWORD_RESET_REQUESTED", userId: u.id },
    });
    expect(log).not.toBeNull();
  });

  it("unknown email -> 200 without sending mail", async () => {
    const { POST } = await import("@/app/api/auth/forgot-password/route");
    const res = await POST(makeReq({ email: "ghost@v2-11-forgot.test" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(vi.mocked(sendAccountPasswordReset)).not.toHaveBeenCalled();
  });

  it("unverified email -> 200 without sending mail", async () => {
    const u = await prisma.user.create({
      data: {
        email: "unverified@v2-11-forgot.test",
        password: "x",
        name: "U",
      },
    });
    const { POST } = await import("@/app/api/auth/forgot-password/route");
    const res = await POST(makeReq({ email: u.email }));
    expect(res.status).toBe(200);
    expect(vi.mocked(sendAccountPasswordReset)).not.toHaveBeenCalled();
    const updated = await prisma.user.findUnique({ where: { id: u.id } });
    expect(updated?.passwordResetToken).toBeNull();
  });

  it("blocked email -> 200 without sending mail", async () => {
    const u = await prisma.user.create({
      data: {
        email: "blocked@v2-11-forgot.test",
        password: "x",
        name: "B",
        emailVerifiedAt: new Date(),
        blocked: true,
        blockedReason: "test",
      },
    });
    const { POST } = await import("@/app/api/auth/forgot-password/route");
    const res = await POST(makeReq({ email: u.email }));
    expect(res.status).toBe(200);
    expect(vi.mocked(sendAccountPasswordReset)).not.toHaveBeenCalled();
    const updated = await prisma.user.findUnique({ where: { id: u.id } });
    expect(updated?.passwordResetToken).toBeNull();
  });

  it("returns 400 INVALID_BODY when the email is malformed", async () => {
    const { POST } = await import("@/app/api/auth/forgot-password/route");
    const res = await POST(makeReq({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_BODY");
  });

  it("returns 400 INVALID_BODY when the JSON body is malformed (req.json() rejects)", async () => {
    const { POST } = await import("@/app/api/auth/forgot-password/route");
    const res = await POST(makeRawReq("{not-json"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_BODY");
  });

  it("returns 400 RECAPTCHA_* when recaptcha verification fails", async () => {
    vi.mocked(verifyRecaptcha).mockResolvedValueOnce({ ok: false, code: "REJECTED" });
    const { POST } = await import("@/app/api/auth/forgot-password/route");
    const res = await POST(makeReq({ email: "whoever@v2-11-forgot.test" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("RECAPTCHA_REJECTED");
  });

  it("returns 429 RATE_LIMITED after exceeding the request quota", async () => {
    const { POST } = await import("@/app/api/auth/forgot-password/route");
    let last;
    for (let i = 0; i < 6; i++) {
      last = await POST(makeReq({ email: "quota@v2-11-forgot.test" }));
    }
    expect(last!.status).toBe(429);
    const json = await last!.json();
    expect(json.code).toBe("RATE_LIMITED");
    expect(last!.headers.get("Retry-After")).toBeTruthy();
  });
});
