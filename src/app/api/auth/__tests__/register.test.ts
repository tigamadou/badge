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
import { verifyRecaptcha } from "@/lib/recaptcha";

function makeRawReq(rawBody: string): NextRequest {
  return new NextRequest("http://localhost/api/auth/register", {
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

  it("returns 400 INVALID_BODY when the JSON body is malformed (req.json() rejects)", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(makeRawReq("{not-json"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_BODY");
  });

  it("returns 400 RECAPTCHA_* when recaptcha verification fails", async () => {
    vi.mocked(verifyRecaptcha).mockResolvedValueOnce({ ok: false, code: "LOW_SCORE" });
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(
      makeReq({
        email: "recaptcha-ko@v2-11-register.test",
        password: "password123",
        name: "Ko",
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("RECAPTCHA_LOW_SCORE");
    const user = await prisma.user.findUnique({
      where: { email: "recaptcha-ko@v2-11-register.test" },
    });
    expect(user).toBeNull();
  });

  it("returns 403 EMAIL_BLOCKED when the email is platform-blocked", async () => {
    const email = "blocked@v2-11-register.test";
    await prisma.blockedEmail.create({
      data: { email, eventId: null, reason: "test" },
    });
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(
      makeReq({ email, password: "password123", name: "Blocked" }),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("EMAIL_BLOCKED");
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeNull();
  });

  it("returns 429 RATE_LIMITED after exceeding the request quota", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    let last;
    for (let i = 0; i < 11; i++) {
      last = await POST(
        makeReq({
          email: `quota-${i}@v2-11-register.test`,
          password: "password123",
          name: "Quota",
        }),
      );
    }
    expect(last!.status).toBe(429);
    const json = await last!.json();
    expect(json.code).toBe("RATE_LIMITED");
    expect(last!.headers.get("Retry-After")).toBeTruthy();
  });

  it("propage un next interne jusqu'au lien de verification", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(
      makeReq({
        email: "next-ok@v2-11-register.test",
        password: "password123",
        name: "Awa",
        next: "/e/salon-2026/register",
      }),
    );
    expect(res.status).toBe(201);
    expect(sendAccountVerifyEmail).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      "/e/salon-2026/register",
    );
  });

  it("ignore un next externe sans faire echouer l'inscription", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(
      makeReq({
        email: "next-evil@v2-11-register.test",
        password: "password123",
        name: "Awa",
        next: "https://evil.example/phish",
      }),
    );
    expect(res.status).toBe(201);
    expect(sendAccountVerifyEmail).toHaveBeenCalledWith(expect.any(String), expect.any(String), null);
  });

  it("accepte next: null, envoye par le formulaire quand il n'y a pas de destination", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(
      makeReq({
        email: "next-null@v2-11-register.test",
        password: "password123",
        name: "Awa",
        next: null,
      }),
    );
    expect(res.status).toBe(201);
    expect(sendAccountVerifyEmail).toHaveBeenCalledWith(expect.any(String), expect.any(String), null);
  });

  it("envoie sans destination quand next est absent", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(
      makeReq({
        email: "next-absent@v2-11-register.test",
        password: "password123",
        name: "Awa",
      }),
    );
    expect(res.status).toBe(201);
    expect(sendAccountVerifyEmail).toHaveBeenCalledWith(expect.any(String), expect.any(String), null);
  });
});
