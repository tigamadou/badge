import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

async function cleanDb() {
  await prisma.activityLog.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.orgMembership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
}

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/auth/setup-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/auth/setup-password", () => {
  beforeEach(async () => {
    await cleanDb();
  });

  it("returns 400 when body is invalid (missing token)", async () => {
    const { POST } = await import("@/app/api/auth/setup-password/route");
    const res = await POST(makeReq({ password: "secret123" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is too short", async () => {
    const { POST } = await import("@/app/api/auth/setup-password/route");
    const res = await POST(makeReq({ token: "whatever", password: "abc" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 INVALID_OR_EXPIRED_TOKEN when token is unknown", async () => {
    const { POST } = await import("@/app/api/auth/setup-password/route");
    const res = await POST(makeReq({ token: "nope", password: "secret123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_OR_EXPIRED_TOKEN");
  });

  it("returns 400 INVALID_OR_EXPIRED_TOKEN when token is expired", async () => {
    const u = await prisma.user.create({
      data: {
        email: "exp@x.local",
        password: "",
        name: "Exp",
        inviteToken: "tok-expired",
        inviteTokenExpiry: new Date(Date.now() - 1000),
      },
    });
    const { POST } = await import("@/app/api/auth/setup-password/route");
    const res = await POST(makeReq({ token: "tok-expired", password: "secret123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_OR_EXPIRED_TOKEN");

    // Password ne doit pas avoir change
    const reloaded = await prisma.user.findUnique({ where: { id: u.id } });
    expect(reloaded?.password).toBe("");
    expect(reloaded?.inviteToken).toBe("tok-expired");
  });

  it("returns 400 INVALID_OR_EXPIRED_TOKEN when user is archived", async () => {
    await prisma.user.create({
      data: {
        email: "arch@x.local",
        password: "",
        name: "Arch",
        archived: true,
        archivedAt: new Date(),
        inviteToken: "tok-archived",
        inviteTokenExpiry: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    const { POST } = await import("@/app/api/auth/setup-password/route");
    const res = await POST(makeReq({ token: "tok-archived", password: "secret123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_OR_EXPIRED_TOKEN");
  });

  it("returns 200, persists hashed password, clears token, logs USER_PASSWORD_SET", async () => {
    const u = await prisma.user.create({
      data: {
        email: "ok@x.local",
        password: "",
        name: "OK",
        inviteToken: "tok-ok",
        inviteTokenExpiry: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    const { POST } = await import("@/app/api/auth/setup-password/route");
    const res = await POST(makeReq({ token: "tok-ok", password: "secret123" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.email).toBe("ok@x.local");

    const updated = await prisma.user.findUnique({ where: { id: u.id } });
    expect(updated?.inviteToken).toBeNull();
    expect(updated?.inviteTokenExpiry).toBeNull();
    expect(updated?.password).not.toBe("");
    expect(updated?.password).not.toBe("secret123");
    expect(await bcrypt.compare("secret123", updated!.password)).toBe(true);

    const log = await prisma.activityLog.findFirst({
      where: { type: "USER_PASSWORD_SET" },
    });
    expect(log).not.toBeNull();
    expect(log?.userId).toBe(u.id);
    expect(log?.targetId).toBe(u.id);
    const details = log?.details as { setupViaInvite?: boolean } | null;
    expect(details?.setupViaInvite).toBe(true);
    // Le password ne doit JAMAIS apparaitre dans les details
    expect(JSON.stringify(log?.details ?? {})).not.toContain("secret123");
  });
});
