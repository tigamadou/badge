import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ensureSystemRoles, legacyKeyOf, systemRoleId } from "../db";
import { SYSTEM_ROLES, type SystemRoleKey } from "../system-roles";

describe("ensureSystemRoles", () => {
  it("crée les 14 rôles système puis reste idempotent", async () => {
    const first = await ensureSystemRoles(prisma);
    const rows = await prisma.role.findMany();
    expect(rows).toHaveLength(14);
    for (const row of rows) {
      const def = SYSTEM_ROLES[row.systemKey as SystemRoleKey];
      expect(row.scope).toBe(def.scope);
      expect(row.name).toBe(def.name);
      expect(row.orgId).toBeNull();
      expect(first[def.key]).toBe(row.id);
    }
    expect(Object.keys(first)).toHaveLength(14);

    const second = await ensureSystemRoles(prisma);
    expect(second).toEqual(first);
    expect(await prisma.role.count()).toBe(14);
  });

  it("met à jour le nom et la description si le code a changé", async () => {
    const ids = await ensureSystemRoles(prisma);
    await prisma.role.update({ where: { id: ids.OWNER }, data: { name: "Ancien nom", description: "Ancienne" } });
    await ensureSystemRoles(prisma);
    const row = await prisma.role.findUniqueOrThrow({ where: { id: ids.OWNER } });
    expect(row.name).toBe(SYSTEM_ROLES.OWNER.name);
    expect(row.description).toBe(SYSTEM_ROLES.OWNER.description);
  });
});

describe("systemRoleId", () => {
  it("renvoie l'id du rôle système, en le créant au besoin", async () => {
    const id = await systemRoleId(prisma, "AGENT");
    const row = await prisma.role.findUniqueOrThrow({ where: { systemKey: "AGENT" } });
    expect(id).toBe(row.id);
  });
});

describe("legacyKeyOf", () => {
  it("renvoie la clé d'enum héritée ou null", () => {
    expect(legacyKeyOf("STAFF_PRINTER")).toBeNull();
    expect(legacyKeyOf("AGENT")).toBeNull();
    expect(legacyKeyOf("PARTICIPANT")).toBeNull();
    expect(legacyKeyOf("OWNER")).toBe("OWNER");
    expect(legacyKeyOf("STAFF_OBSERVER")).toBe("STAFF_OBSERVER");
    expect(legacyKeyOf("VIEWER")).toBe("VIEWER");
  });
});
