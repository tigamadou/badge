import { describe, it, expect, beforeEach } from "vitest";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { seedSuperAdmin } from "@/lib/seed-super-admin";

const ENV = {
  SEED_SUPER_ADMIN_EMAIL: " Root@Badge.Test ",
  SEED_SUPER_ADMIN_PASSWORD: "secret123",
};

describe("seedSuperAdmin", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.user.deleteMany();
  });

  it("cree le SUPER_ADMIN avec email normalise, mot de passe hashe et audit", async () => {
    const result = await seedSuperAdmin(ENV);

    expect(result).toEqual({ status: "created", email: "root@badge.test" });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "root@badge.test" } });
    expect(user.isStaff).toBe(true);
    expect(user.staffRole).toBe("SUPER_ADMIN");
    const role = await prisma.role.findUniqueOrThrow({ where: { systemKey: "SUPER_ADMIN" } });
    expect(user.platformRoleId).toBe(role.id);
    expect(user.name).toBe("Super Admin");
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(await compare("secret123", user.password)).toBe(true);
    const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "USER_CREATED" } });
    expect(log.targetId).toBe(user.id);
  });

  it("utilise SEED_SUPER_ADMIN_NAME s'il est fourni", async () => {
    await seedSuperAdmin({ ...ENV, SEED_SUPER_ADMIN_NAME: "  Admin Plateforme " });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "root@badge.test" } });
    expect(user.name).toBe("Admin Plateforme");
  });

  it("ne fait rien des qu'un SUPER_ADMIN existe, meme avec un autre email", async () => {
    await prisma.user.create({
      data: {
        email: "autre@badge.test",
        password: "hash-original",
        name: "Admin renomme",
        isStaff: true,
        staffRole: "SUPER_ADMIN",
      },
    });

    expect(await seedSuperAdmin(ENV)).toEqual({ status: "exists" });
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.activityLog.count()).toBe(0);
  });

  it("ne lit pas l'environnement quand un SUPER_ADMIN existe", async () => {
    await seedSuperAdmin(ENV);
    expect((await seedSuperAdmin({})).status).toBe("exists");
    expect(await prisma.user.count()).toBe(1);
  });

  it("ignore un SUPER_ADMIN archive et cree le compte", async () => {
    await prisma.user.create({
      data: {
        email: "ancien@badge.test",
        password: "x",
        name: "Ancien",
        isStaff: true,
        staffRole: "SUPER_ADMIN",
        archived: true,
        archivedAt: new Date(),
      },
    });
    expect((await seedSuperAdmin(ENV)).status).toBe("created");
  });

  it("ne fait rien si un SUPER_ADMIN existe par roleId seulement (sans colonne d'enum)", async () => {
    const role = await prisma.role.create({
      data: { systemKey: "SUPER_ADMIN", scope: "PLATFORM", name: "Super administrateur" },
    });
    await prisma.user.create({
      data: { email: "roleid@badge.test", password: "x", name: "Par roleId", isStaff: true, platformRoleId: role.id },
    });
    expect(await seedSuperAdmin(ENV)).toEqual({ status: "exists" });
    expect(await prisma.user.count()).toBe(1);
  });

  it("ne compte pas un autre role staff comme SUPER_ADMIN", async () => {
    await prisma.user.create({
      data: {
        email: "staff@badge.test",
        password: "x",
        name: "Staff",
        isStaff: true,
        staffRole: "STAFF_ADMIN",
      },
    });
    expect((await seedSuperAdmin(ENV)).status).toBe("created");
  });

  it("echoue si l'email est deja pris par un compte non SUPER_ADMIN", async () => {
    await prisma.user.create({
      data: { email: "root@badge.test", password: "hash-original", name: "Participant" },
    });

    await expect(seedSuperAdmin(ENV)).rejects.toThrow(/root@badge\.test/);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "root@badge.test" } });
    expect(user.password).toBe("hash-original");
    expect(user.isStaff).toBe(false);
  });

  it("ignore le seed si une variable manque", async () => {
    expect((await seedSuperAdmin({ SEED_SUPER_ADMIN_EMAIL: "a@b.c" })).status).toBe("skipped");
    expect((await seedSuperAdmin({ SEED_SUPER_ADMIN_PASSWORD: "secret123" })).status).toBe(
      "skipped",
    );
    expect(await prisma.user.count()).toBe(0);
  });

  it("refuse un mot de passe de moins de 6 caracteres", async () => {
    await expect(
      seedSuperAdmin({ ...ENV, SEED_SUPER_ADMIN_PASSWORD: "12345" }),
    ).rejects.toThrow(/6 caractères/);
    expect(await prisma.user.count()).toBe(0);
  });

  it("lit process.env par defaut", async () => {
    const saved = { ...process.env };
    Object.assign(process.env, ENV);
    try {
      expect((await seedSuperAdmin()).status).toBe("created");
    } finally {
      process.env = saved;
    }
  });
});
