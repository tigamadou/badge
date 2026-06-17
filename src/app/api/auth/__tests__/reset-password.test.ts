import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "@/lib/auth-tokens";
import { resetRateLimitForTests } from "@/lib/rate-limit";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    resetRateLimitForTests();
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
});
