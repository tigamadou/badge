import { describe, it, expect, beforeEach, vi } from "vitest";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

// Seul l'audit est mocke (pour assertion + eviter une ecriture ActivityLog) ;
// la DB reste reelle (coherent avec les autres tests lib et le reset global).
vi.mock("@/lib/activity-log", () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }));
import { logActivity } from "@/lib/activity-log";

const provider = authOptions.providers[0] as unknown as {
  authorize?: (c: unknown) => Promise<unknown>;
  options?: { authorize?: (c: unknown) => Promise<unknown> };
};
// next-auth v4 : le `authorize` de premier niveau du provider est un stub `() => null` ;
// le vrai callback vit dans `provider.options.authorize`.
const authorize = (provider.options?.authorize ?? provider.authorize)!;

const PASSWORD = "s3cret";

type UserOverrides = {
  email?: string;
  archived?: boolean;
  emailVerifiedAt?: Date | null;
  blocked?: boolean;
  isStaff?: boolean;
};

async function makeUser(overrides: UserOverrides = {}) {
  return prisma.user.create({
    data: {
      email: overrides.email ?? "user@test.fr",
      name: "User",
      password: await hash(PASSWORD, 4),
      emailVerifiedAt: overrides.emailVerifiedAt === undefined ? new Date() : overrides.emailVerifiedAt,
      archived: overrides.archived ?? false,
      blocked: overrides.blocked ?? false,
      isStaff: overrides.isStaff ?? false,
    },
  });
}

describe("authOptions.authorize", () => {
  beforeEach(() => {
    vi.mocked(logActivity).mockClear();
  });

  it("retourne null si aucune credential", async () => {
    expect(await authorize(undefined)).toBeNull();
  });

  it("retourne null si email manquant", async () => {
    expect(await authorize({ password: "x" })).toBeNull();
  });

  it("retourne null si mot de passe manquant", async () => {
    expect(await authorize({ email: "user@test.fr" })).toBeNull();
  });

  it("retourne null si utilisateur introuvable", async () => {
    expect(await authorize({ email: "nobody@test.fr", password: PASSWORD })).toBeNull();
  });

  it("retourne null si compte archive", async () => {
    await makeUser({ archived: true });
    expect(await authorize({ email: "user@test.fr", password: PASSWORD })).toBeNull();
  });

  it("retourne null si email non verifie", async () => {
    await makeUser({ emailVerifiedAt: null });
    expect(await authorize({ email: "user@test.fr", password: PASSWORD })).toBeNull();
  });

  it("retourne null si compte bloque", async () => {
    await makeUser({ blocked: true });
    expect(await authorize({ email: "user@test.fr", password: PASSWORD })).toBeNull();
  });

  it("retourne null si mot de passe invalide", async () => {
    await makeUser();
    expect(await authorize({ email: "user@test.fr", password: "mauvais" })).toBeNull();
  });

  it("succes : retourne l'utilisateur et journalise la connexion", async () => {
    const u = await makeUser({ isStaff: true });
    const res = (await authorize({ email: "user@test.fr", password: PASSWORD })) as {
      id: string;
      email: string;
      name: string;
      isStaff: boolean;
    };
    expect(res).toMatchObject({ id: u.id, email: "user@test.fr", name: "User", isStaff: true });
    expect(logActivity).toHaveBeenCalledWith({ type: "USER_LOGIN", userId: u.id });
  });

  it("normalise l'email (trim + lowercase) avant la recherche", async () => {
    const u = await makeUser({ email: "user@test.fr" });
    const res = (await authorize({ email: "  USER@TEST.FR  ", password: PASSWORD })) as { id: string } | null;
    expect(res?.id).toBe(u.id);
  });

  it("l'echec de lastLoginAt est avale (fire-and-forget)", async () => {
    const u = await makeUser();
    const updateSpy = vi.spyOn(prisma.user, "update").mockRejectedValueOnce(new Error("db down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await authorize({ email: "user@test.fr", password: PASSWORD });
    expect((res as { id: string }).id).toBe(u.id);
    // Laisse la microtask du .catch se resoudre.
    await new Promise((r) => setTimeout(r, 10));
    expect(errSpy).toHaveBeenCalled();
    updateSpy.mockRestore();
    errSpy.mockRestore();
  });
});

describe("authOptions.callbacks", () => {
  const cb = authOptions.callbacks as unknown as {
    jwt: (a: { token: Record<string, unknown>; user?: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    session: (a: { session: Record<string, unknown>; token: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  };

  it("jwt copie les champs quand user est present", async () => {
    const token = await cb.jwt({ token: {}, user: { id: "u1", email: "a@b.fr", name: "A", isStaff: true } });
    expect(token).toMatchObject({ id: "u1", email: "a@b.fr", name: "A", isStaff: true });
  });

  it("jwt renvoie le token inchange sans user", async () => {
    const token = await cb.jwt({ token: { id: "existing" } });
    expect(token).toEqual({ id: "existing" });
  });

  it("session projette le token dans session.user", async () => {
    const session = (await cb.session({
      session: {},
      token: { id: "u1", email: "a@b.fr", name: "A", isStaff: false },
    })) as { user: Record<string, unknown> };
    expect(session.user).toMatchObject({ id: "u1", email: "a@b.fr", name: "A", isStaff: false });
  });
});
