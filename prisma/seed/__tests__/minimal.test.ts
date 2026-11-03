import { describe, it, expect, beforeEach, vi } from "vitest";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { runMinimalSeed } from "../minimal";

const DEV = { BADGE_ENV: "dev" };

async function counts() {
  return {
    users: await prisma.user.count(),
    plans: await prisma.plan.count(),
    reasons: await prisma.rejectionReason.count(),
    layouts: await prisma.printSheetLayout.count(),
    accessories: await prisma.printProduct.count({ where: { kind: "ACCESSORY", published: true } }),
    templates: await prisma.installedBadgeTemplate.count(),
    settings: await prisma.platformSettings.count(),
  };
}

describe("runMinimalSeed", () => {
  beforeEach(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await prisma.platformSettings.deleteMany();
    await prisma.installedBadgeTemplate.deleteMany();
  });

  it("pose les donnees de reference et un seul SUPER_ADMIN en dev", async () => {
    await runMinimalSeed(DEV);

    expect(await prisma.platformSettings.findUnique({ where: { id: "singleton" } })).not.toBeNull();
    expect(await prisma.plan.count({ where: { name: "Standard" } })).toBe(1);
    expect(await prisma.plan.count()).toBe(2);
    expect(await prisma.plan.count({ where: { name: "free" } })).toBe(1);
    expect(await prisma.rejectionReason.count()).toBe(9);
    expect(await prisma.printSheetLayout.count({ where: { name: "A3 standard" } })).toBe(1);
    expect(await prisma.printProduct.count({ where: { kind: "ACCESSORY", published: true } })).toBe(5);
    expect(await prisma.installedBadgeTemplate.count()).toBeGreaterThan(0);

    const settings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: "singleton" } });
    expect(await prisma.installedBadgeTemplate.count({ where: { id: settings.badgeTemplateId } })).toBe(1);

    const users = await prisma.user.findMany();
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe("admin@badge.local");
    expect(users[0].staffRole).toBe("SUPER_ADMIN");
    expect(await compare("123456", users[0].password)).toBe(true);
    expect(await prisma.organization.count()).toBe(0);
    expect(await prisma.event.count()).toBe(0);
  });

  it("est idempotent et remet le mot de passe de dev", async () => {
    await runMinimalSeed(DEV);
    const first = await counts();
    await prisma.user.update({
      where: { email: "admin@badge.local" },
      data: { password: await hash("autre-mot-de-passe", 4) },
    });

    await runMinimalSeed(DEV);

    expect(await counts()).toEqual(first);
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@badge.local" } });
    expect(await compare("123456", admin.password)).toBe(true);
  });

  it("utilise les variables SEED_SUPER_ADMIN_* hors dev", async () => {
    await runMinimalSeed({
      BADGE_ENV: "preprod",
      SEED_SUPER_ADMIN_EMAIL: "root@badge.test",
      SEED_SUPER_ADMIN_PASSWORD: "secret123",
    });

    const users = await prisma.user.findMany();
    expect(users.map((u) => u.email)).toEqual(["root@badge.test"]);
    expect(users[0].staffRole).toBe("SUPER_ADMIN");
    expect(await prisma.organization.count()).toBe(0);
    expect(await prisma.event.count()).toBe(0);
  });

  it("ne cree aucun utilisateur en preprod sans variables, sans exception", async () => {
    await runMinimalSeed({ BADGE_ENV: "preprod" });

    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.installedBadgeTemplate.count()).toBeGreaterThan(0);
    expect(await prisma.organization.count()).toBe(0);
    expect(await prisma.event.count()).toBe(0);
  });
});
