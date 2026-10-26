import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

async function createUser() {
  return prisma.user.create({
    data: { email: `notif-schema-${Date.now()}@test.local`, password: "x", name: "Notif Schema" },
  });
}

describe("schéma Notification", () => {
  it("crée une notification et la relit par l'index utilisateur", async () => {
    const user = await createUser();
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "ORG_CREATED",
        scope: "PLATFORM",
        title: "T",
        body: "B",
        links: [{ label: "A", href: "/a" }],
      },
    });
    const rows = await prisma.notification.findMany({ where: { userId: user.id, readAt: null } });
    expect(rows).toHaveLength(1);
    expect(rows[0].links).toEqual([{ label: "A", href: "/a" }]);
  });

  it("supprime les notifications avec l'utilisateur", async () => {
    const user = await createUser();
    await prisma.notification.create({
      data: { userId: user.id, type: "ORG_CREATED", scope: "PLATFORM", title: "T", body: "B" },
    });
    await prisma.user.delete({ where: { id: user.id } });
    expect(await prisma.notification.count({ where: { userId: user.id } })).toBe(0);
  });
});
