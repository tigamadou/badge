import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { rewriteNotificationLinks } from "../rewrite-links";
import { makeNotification, makeUser } from "./helpers";

async function notifFor(userId: string, id: string, extraLink = true) {
  const href = `/event/e1/registrations/${id}`;
  return makeNotification(userId, {
    links: extraLink
      ? [{ label: "Voir l'inscription", href }, { label: "Voir l'évènement", href: "/event/e1" }]
      : [{ label: "Voir l'inscription", href }],
  });
}

describe("rewriteNotificationLinks", () => {
  it("réécrit href et links de toutes les notifications de l'inscription", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const n1 = await notifFor(a.id, "1234");
    const n2 = await notifFor(b.id, "1234", false);
    await prisma.notification.updateMany({ data: { href: `/event/e1/registrations/1234` } });
    const count = await rewriteNotificationLinks("1234", "5678");
    expect(count).toBe(2);
    const rows = await prisma.notification.findMany({ where: { id: { in: [n1.id, n2.id] } } });
    for (const r of rows) {
      expect(r.href).toBe("/event/e1/registrations/5678");
      expect((r.links as { href: string }[])[0].href).toBe("/event/e1/registrations/5678");
    }
    const first = rows.find((r) => r.id === n1.id)!;
    expect((first.links as { href: string }[])[1].href).toBe("/event/e1");
  });

  it("réécrit aussi un lien suivi d'un chemin, d'une requête ou d'une ancre", async () => {
    const a = await makeUser();
    const n = await makeNotification(a.id, { links: [{ label: "x", href: "/account/registrations/1234?x=1" }] });
    await prisma.notification.update({ where: { id: n.id }, data: { href: "/account/registrations/1234/edit" } });
    expect(await rewriteNotificationLinks("1234", "5678")).toBe(1);
    const r = await prisma.notification.findUniqueOrThrow({ where: { id: n.id } });
    expect(r.href).toBe("/account/registrations/5678/edit");
    expect((r.links as { href: string }[])[0].href).toBe("/account/registrations/5678?x=1");
  });

  it("ne réécrit pas un ID qui contient l'ancien en sous-chaîne", async () => {
    const a = await makeUser();
    const n = await notifFor(a.id, "91234");
    await prisma.notification.update({ where: { id: n.id }, data: { href: "/event/e/registrations/91234" } });
    expect(await rewriteNotificationLinks("1234", "5678")).toBe(0);
    const r = await prisma.notification.findUniqueOrThrow({ where: { id: n.id } });
    expect(r.href).toBe("/event/e/registrations/91234");
  });

  it("ignore une colonne links nulle", async () => {
    const a = await makeUser();
    const n = await makeNotification(a.id, { links: null });
    await prisma.notification.update({ where: { id: n.id }, data: { href: "/account/registrations/1234" } });
    await prisma.$executeRaw`UPDATE Notification SET links = NULL WHERE id = ${n.id}`;
    expect(await rewriteNotificationLinks("1234", "5678")).toBe(1);
    const r = await prisma.notification.findUniqueOrThrow({ where: { id: n.id } });
    expect(r.href).toBe("/account/registrations/5678");
    expect(r.links).toBeNull();
  });

  it("fonctionne dans une transaction", async () => {
    const a = await makeUser();
    const n = await notifFor(a.id, "1234");
    await prisma.notification.update({ where: { id: n.id }, data: { href: "/account/registrations/1234" } });
    await expect(
      prisma.$transaction(async (tx) => {
        expect(await rewriteNotificationLinks("1234", "5678", tx)).toBe(1);
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: n.id } })).href).toBe("/account/registrations/1234");
  });
});
