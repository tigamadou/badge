import { describe, it, expect, beforeEach } from "vitest";

import { prisma } from "@/lib/prisma";
import { generateToken, hashToken, computeExpiry, EMAIL_VERIFY_TTL_MS } from "@/lib/auth-tokens";

async function cleanDb() {
  await prisma.activityLog.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.orgMembership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
}

// Cree un user portant un token de verification (hash en BDD, clair retourne).
async function seedUser(opts: {
  verified?: boolean;
  expired?: boolean;
  archived?: boolean;
  blocked?: boolean;
} = {}) {
  const token = generateToken();
  const user = await prisma.user.create({
    data: {
      email: `verify-${Date.now()}-${Math.random().toString(36).slice(2)}@x.local`,
      password: "",
      name: "Verif",
      emailVerifiedAt: opts.verified ? new Date() : null,
      archived: opts.archived ?? false,
      blocked: opts.blocked ?? false,
      emailVerifyToken: hashToken(token),
      emailVerifyTokenExpiry: opts.expired
        ? new Date(Date.now() - 1000)
        : computeExpiry(EMAIL_VERIFY_TTL_MS),
    },
  });
  return { token, user };
}

describe("consumeEmailVerifyToken", () => {
  beforeEach(async () => {
    await cleanDb();
  });

  it("verifie un token valide et consomme le token", async () => {
    const { consumeEmailVerifyToken } = await import("@/lib/verify-email");
    const { token, user } = await seedUser();

    const result = await consumeEmailVerifyToken(token);

    expect(result.status).toBe("verified");
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after?.emailVerifiedAt).not.toBeNull();
    expect(after?.emailVerifyToken).toBeNull();
    expect(after?.emailVerifyTokenExpiry).toBeNull();
  });

  it("logge USER_EMAIL_VERIFIED lors de la verification", async () => {
    const { consumeEmailVerifyToken } = await import("@/lib/verify-email");
    const { token, user } = await seedUser();

    await consumeEmailVerifyToken(token);

    const log = await prisma.activityLog.findFirst({
      where: { type: "USER_EMAIL_VERIFIED", userId: user.id },
    });
    expect(log).not.toBeNull();
  });

  it("est idempotent : un compte deja verifie renvoie already-verified", async () => {
    const { consumeEmailVerifyToken } = await import("@/lib/verify-email");
    const { token, user } = await seedUser({ verified: true });

    const result = await consumeEmailVerifyToken(token);

    expect(result.status).toBe("already-verified");
    // Le token est nettoye meme dans ce cas.
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after?.emailVerifyToken).toBeNull();
  });

  it("refuse un token expire", async () => {
    const { consumeEmailVerifyToken } = await import("@/lib/verify-email");
    const { token } = await seedUser({ expired: true });

    const result = await consumeEmailVerifyToken(token);

    expect(result.status).toBe("invalid-or-expired");
  });

  it("refuse un token inconnu", async () => {
    const { consumeEmailVerifyToken } = await import("@/lib/verify-email");

    const result = await consumeEmailVerifyToken("token-inexistant");

    expect(result.status).toBe("invalid-or-expired");
  });

  it("refuse un compte archive", async () => {
    const { consumeEmailVerifyToken } = await import("@/lib/verify-email");
    const { token } = await seedUser({ archived: true });

    const result = await consumeEmailVerifyToken(token);

    expect(result.status).toBe("invalid-or-expired");
  });

  it("refuse un compte bloque", async () => {
    const { consumeEmailVerifyToken } = await import("@/lib/verify-email");
    const { token } = await seedUser({ blocked: true });

    const result = await consumeEmailVerifyToken(token);

    expect(result.status).toBe("invalid-or-expired");
  });
});
