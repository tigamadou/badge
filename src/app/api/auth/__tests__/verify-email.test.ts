import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "@/lib/auth-tokens";
import { resetRateLimitForTests } from "@/lib/rate-limit";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/auth/verify-email", () => {
  beforeEach(() => {
    resetRateLimitForTests();
  });

  it("activates the account when token is valid", async () => {
    const plain = generateToken();
    const user = await prisma.user.create({
      data: {
        email: "ok@v2-11-verify.test",
        password: "x",
        name: "Ok",
        emailVerifyToken: hashToken(plain),
        emailVerifyTokenExpiry: new Date(Date.now() + 60_000),
      },
    });

    const { POST } = await import("@/app/api/auth/verify-email/route");
    const res = await POST(makeReq({ token: plain }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.alreadyVerified).toBeUndefined();

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.emailVerifiedAt).not.toBeNull();
    expect(updated?.emailVerifyToken).toBeNull();
    expect(updated?.emailVerifyTokenExpiry).toBeNull();

    const log = await prisma.activityLog.findFirst({
      where: { type: "USER_EMAIL_VERIFIED", userId: user.id },
    });
    expect(log).not.toBeNull();
  });

  it("returns 400 when the token is unknown", async () => {
    const { POST } = await import("@/app/api/auth/verify-email/route");
    const res = await POST(makeReq({ token: "this-token-does-not-exist" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_OR_EXPIRED_TOKEN");
  });

  it("returns 400 when the token is expired", async () => {
    const plain = generateToken();
    await prisma.user.create({
      data: {
        email: "exp@v2-11-verify.test",
        password: "x",
        name: "Exp",
        emailVerifyToken: hashToken(plain),
        emailVerifyTokenExpiry: new Date(Date.now() - 1000),
      },
    });

    const { POST } = await import("@/app/api/auth/verify-email/route");
    const res = await POST(makeReq({ token: plain }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_OR_EXPIRED_TOKEN");
  });

  it("is idempotent when account is already verified (200 alreadyVerified)", async () => {
    const plain = generateToken();
    const user = await prisma.user.create({
      data: {
        email: "idem@v2-11-verify.test",
        password: "x",
        name: "Idem",
        emailVerifyToken: hashToken(plain),
        emailVerifyTokenExpiry: new Date(Date.now() + 60_000),
        emailVerifiedAt: new Date(),
      },
    });

    const { POST } = await import("@/app/api/auth/verify-email/route");
    const res = await POST(makeReq({ token: plain }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.alreadyVerified).toBe(true);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.emailVerifyToken).toBeNull();
    expect(updated?.emailVerifyTokenExpiry).toBeNull();
  });
});
