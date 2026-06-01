import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { hashToken, EMAIL_VERIFY_TTL_MS } from "@/lib/auth-tokens";
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

import { sendAccountVerifyEmail } from "@/lib/mail";

async function seedPlatform() {
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      smtpHost: "localhost",
      smtpPort: 587,
      smtpFrom: "noreply@v2-11-register.test",
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
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/auth/register", () => {
  beforeEach(async () => {
    resetRateLimitForTests();
    vi.mocked(sendAccountVerifyEmail).mockClear();
    await seedPlatform();
  });

  it("returns 201 and creates the user with a hashed email verify token (~24h)", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const before = Date.now();
    const res = await POST(
      makeReq({
        email: "alice@v2-11-register.test",
        password: "password123",
        name: "Alice",
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(typeof json.userId).toBe("string");

    const user = await prisma.user.findUnique({ where: { id: json.userId } });
    expect(user).not.toBeNull();
    expect(user?.email).toBe("alice@v2-11-register.test");
    expect(user?.password).not.toBe("password123");
    expect(user?.emailVerifyToken).toBeTruthy();
    // Token stored is a hash, not the plain token.
    expect(user!.emailVerifyToken!.length).toBe(64); // sha256 hex = 64 chars

    // expiry ~24h from now
    expect(user?.emailVerifyTokenExpiry).toBeInstanceOf(Date);
    const exp = user!.emailVerifyTokenExpiry!.getTime();
    expect(exp).toBeGreaterThanOrEqual(before + EMAIL_VERIFY_TTL_MS - 1000);
    expect(exp).toBeLessThanOrEqual(Date.now() + EMAIL_VERIFY_TTL_MS + 1000);

    // mail sent with plain token (we receive the plain token argument)
    expect(vi.mocked(sendAccountVerifyEmail)).toHaveBeenCalledTimes(1);
    const [userIdArg, plainToken] = vi.mocked(sendAccountVerifyEmail).mock.calls[0]!;
    expect(userIdArg).toBe(json.userId);
    expect(typeof plainToken).toBe("string");
    expect(plainToken.length).toBeGreaterThanOrEqual(40);
    // The hash of the plain token must match what's stored.
    expect(hashToken(plainToken)).toBe(user!.emailVerifyToken);

    // activity log
    const log = await prisma.activityLog.findFirst({
      where: { type: "USER_REGISTERED", userId: json.userId },
    });
    expect(log).not.toBeNull();
  });

  it("returns 409 when the email is already taken", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    await prisma.user.create({
      data: {
        email: "dup@v2-11-register.test",
        password: "h",
        name: "Existing",
      },
    });
    const res = await POST(
      makeReq({
        email: "dup@v2-11-register.test",
        password: "password123",
        name: "Dup",
      }),
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("EMAIL_TAKEN");
  });

  it("returns 400 when the password is too short", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(
      makeReq({
        email: "shortpw@v2-11-register.test",
        password: "abc",
        name: "Short",
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_BODY");
  });

  it("returns 400 when the email is invalid", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(
      makeReq({
        email: "not-an-email",
        password: "password123",
        name: "Bad",
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_BODY");
  });
});
