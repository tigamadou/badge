// PATCH /api/platform/settings : contrôle par champ, aucune écriture partielle.
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SUBSCRIPTION_RIGHTS } from "@/lib/subscription-rights";
import type { Permission } from "@/lib/permissions";
import { makeCustomRole, makeStaff, makeUser } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

const RIGHTS = Object.fromEntries(SUBSCRIPTION_RIGHTS.map((r) => [r, { active: true, inactive: false }]));

async function asRole(permissions: Permission[]) {
  const role = await makeCustomRole({ scope: "PLATFORM", permissions });
  const u = await makeUser({ isStaff: true, platformRoleId: role.id });
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: u.id, isStaff: true } } as never);
  return u;
}

async function patch(body: unknown) {
  const { PATCH } = await import("../route");
  const res = await PATCH(
    new NextRequest("http://localhost/api/platform/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({}) },
  );
  return { status: res.status, json: await res.json() };
}

async function settings() {
  return prisma.platformSettings.findUniqueOrThrow({ where: { id: "singleton" } });
}

// Les droits d'abonnement écrits par ces tests ne doivent pas survivre au fichier (les gardes d'écriture des autres fichiers les lisent).
afterAll(async () => {
  await prisma.platformSettings.updateMany({ data: { subscriptionRights: Prisma.DbNull } });
});

describe("PATCH /api/platform/settings : permissions par champ", () => {
  beforeEach(async () => {
    vi.mocked(getServerSession).mockReset();
    await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", smtpHost: "avant.test", smtpPassword: "secret-avant" },
      update: { smtpHost: "avant.test", smtpPassword: "secret-avant" },
    });
  });

  it("settings.update seul + secret : 403 FORBIDDEN_SECRET_CHANGE, base inchangée", async () => {
    await asRole(["settings.read", "settings.update"]);
    const res = await patch({ smtpHost: "apres.test", smtpPassword: "nouveau" });
    expect(res).toEqual({ status: 403, json: { error: "FORBIDDEN_SECRET_CHANGE" } });
    const s = await settings();
    expect(s.smtpHost).toBe("avant.test");
    expect(s.smtpPassword).toBe("secret-avant");
  });

  it("settings.update seul + droits d'abonnement : 403 PERMISSION_DENIED, rien écrit", async () => {
    await asRole(["settings.read", "settings.update"]);
    const res = await patch({ smtpHost: "apres.test", subscriptionRights: RIGHTS });
    expect(res).toEqual({ status: 403, json: { error: "PERMISSION_DENIED" } });
    expect((await settings()).smtpHost).toBe("avant.test");
  });

  it("droits d'abonnement seuls avec leur permission : 200 ; un autre champ en plus : 403", async () => {
    await asRole(["settings.read", "settings.subscription_rights.update"]);
    expect((await patch({ subscriptionRights: RIGHTS })).status).toBe(200);
    const mixed = await patch({ smtpHost: "apres.test", subscriptionRights: RIGHTS });
    expect(mixed).toEqual({ status: 403, json: { error: "PERMISSION_DENIED" } });
    expect((await settings()).smtpHost).toBe("avant.test");
  });

  it("un corps sans effet (secret vide) exige settings.update", async () => {
    await asRole(["settings.read", "settings.subscription_rights.update"]);
    expect((await patch({ smtpPassword: "" })).status).toBe(403);
  });

  it("settings.update + secrets.update + droits d'abonnement : 200 sur un corps mixte", async () => {
    await asRole(["settings.read", "settings.update", "settings.secrets.update", "settings.subscription_rights.update"]);
    // `reserved` n'est pas en cause ici : settings.secrets.update est cochable dans un rôle personnalisé.
    const res = await patch({ smtpHost: "apres.test", smtpPassword: "nouveau", subscriptionRights: RIGHTS });
    expect(res.status).toBe(200);
    expect(res.json.settings.smtpHost).toBe("apres.test");
    expect((await settings()).smtpPassword).toBe("nouveau");
  });

  it("l'Observateur (settings.read seul) ne peut rien écrire", async () => {
    const u = await makeStaff("STAFF_OBSERVER");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: u.id, isStaff: true } } as never);
    expect((await patch({ smtpHost: "apres.test" })).status).toBe(403);
    expect((await settings()).smtpHost).toBe("avant.test");
  });
});
