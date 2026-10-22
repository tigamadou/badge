import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "@/lib/auth-tokens";
import { resetRateLimitForTests } from "@/lib/rate-limit";
import { seedRecaptchaPlatform, clearRecaptchaPlatform } from "@/lib/__tests__/recaptcha-platform";

vi.mock("@/lib/recaptcha", () => ({
  verifyRecaptcha: vi.fn().mockResolvedValue({ ok: true }),
}));

import { verifyRecaptcha } from "@/lib/recaptcha";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function makeRawReq(rawBody: string): NextRequest {
  return new NextRequest("http://localhost/api/auth/reset-password", {
    method: "POST",
    body: rawBody,
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/auth/reset-password", () => {
  beforeEach(async () => {
    resetRateLimitForTests();
    await seedRecaptchaPlatform();
    vi.mocked(verifyRecaptcha).mockClear();
  });

  afterAll(clearRecaptchaPlatform);

  describe("reCAPTCHA", () => {
    async function seedResetUser(label: string) {
      const plain = generateToken();
      const user = await prisma.user.create({
        data: {
          email: `${label}@v2-11-reset.test`,
          password: "old-hash",
          name: "Reset",
          emailVerifiedAt: new Date(),
          passwordResetToken: hashToken(plain),
          passwordResetExpiry: new Date(Date.now() + 60_000),
        },
      });
      return { plain, user };
    }

    it("transmet le jeton, la cle secrete et l'IP du client a la verification", async () => {
      const { plain } = await seedResetUser("captcha-ok");
      const { POST } = await import("@/app/api/auth/reset-password/route");
      const res = await POST(
        new NextRequest("http://localhost/api/auth/reset-password", {
          method: "POST",
          body: JSON.stringify({ token: plain, password: "newPassword123", recaptchaToken: "jeton-google" }),
          headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7" },
        }),
      );

      expect(res.status).toBe(200);
      expect(verifyRecaptcha).toHaveBeenCalledWith({
        enabled: true,
        secretKey: "secret-key",
        token: "jeton-google",
        remoteIp: "203.0.113.7",
      });
    });

    it("refuse en 400 RECAPTCHA_* et laisse le compte intact quand la verification echoue", async () => {
      const { plain, user } = await seedResetUser("captcha-ko");
      vi.mocked(verifyRecaptcha).mockResolvedValueOnce({ ok: false, code: "MISSING_TOKEN" });
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const { POST } = await import("@/app/api/auth/reset-password/route");
      const res = await POST(makeReq({ token: plain, password: "newPassword123" }));

      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("RECAPTCHA_MISSING_TOKEN");
      expect(warn).toHaveBeenCalledWith(
        "[recaptcha] verification refusee",
        expect.objectContaining({ route: "reset-password", code: "MISSING_TOKEN" }),
      );
      warn.mockRestore();

      const reloaded = await prisma.user.findUnique({ where: { id: user.id } });
      expect(reloaded?.password).toBe("old-hash");
      expect(reloaded?.passwordResetToken).toBe(hashToken(plain));
    });

    it("verifie le jeton avant de consulter le lien (pas d'indication sur sa validite)", async () => {
      vi.mocked(verifyRecaptcha).mockResolvedValueOnce({ ok: false, code: "LOW_SCORE" });
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const { POST } = await import("@/app/api/auth/reset-password/route");
      const res = await POST(makeReq({ token: "lien-inexistant", password: "newPassword123" }));

      expect((await res.json()).code).toBe("RECAPTCHA_LOW_SCORE");
      warn.mockRestore();
    });
  });

  it("valid token updates password and clears tokens + logs", async () => {
    const plain = generateToken();
    const u = await prisma.user.create({
      data: {
        email: "ok@v2-11-reset.test",
        password: "old-hash",
        name: "Ok",
        emailVerifiedAt: new Date(),
        passwordResetToken: hashToken(plain),
        passwordResetExpiry: new Date(Date.now() + 60_000),
      },
    });

    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(makeReq({ token: plain, password: "newPassword123" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    const updated = await prisma.user.findUnique({ where: { id: u.id } });
    expect(updated?.password).not.toBe("old-hash");
    expect(updated?.password).not.toBe("newPassword123"); // hashed
    expect(updated?.passwordResetToken).toBeNull();
    expect(updated?.passwordResetExpiry).toBeNull();

    const log = await prisma.activityLog.findFirst({
      where: { type: "USER_PASSWORD_RESET_COMPLETED", userId: u.id },
    });
    expect(log).not.toBeNull();
  });

  it("returns 400 for an unknown token", async () => {
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(
      makeReq({ token: "unknown-token-xyz", password: "newPassword123" }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_OR_EXPIRED_TOKEN");
  });

  it("returns 400 for an expired token", async () => {
    const plain = generateToken();
    await prisma.user.create({
      data: {
        email: "exp@v2-11-reset.test",
        password: "x",
        name: "Exp",
        emailVerifiedAt: new Date(),
        passwordResetToken: hashToken(plain),
        passwordResetExpiry: new Date(Date.now() - 1000),
      },
    });
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(makeReq({ token: plain, password: "newPassword123" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_OR_EXPIRED_TOKEN");
  });

  it("returns 400 when the new password is too short", async () => {
    const plain = generateToken();
    await prisma.user.create({
      data: {
        email: "short@v2-11-reset.test",
        password: "x",
        name: "Short",
        emailVerifiedAt: new Date(),
        passwordResetToken: hashToken(plain),
        passwordResetExpiry: new Date(Date.now() + 60_000),
      },
    });
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(makeReq({ token: plain, password: "abc" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_BODY");
  });

  it("returns 400 INVALID_BODY when the JSON body is malformed (req.json() rejects)", async () => {
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(makeRawReq("{not-json"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_BODY");
  });

  it("returns 429 RATE_LIMITED after exceeding the request quota", async () => {
    const { POST } = await import("@/app/api/auth/reset-password/route");
    let last;
    for (let i = 0; i < 11; i++) {
      last = await POST(makeReq({ token: "quota-token", password: "newPassword123" }));
    }
    expect(last!.status).toBe(429);
    const json = await last!.json();
    expect(json.code).toBe("RATE_LIMITED");
    expect(last!.headers.get("Retry-After")).toBeTruthy();
  });
});
