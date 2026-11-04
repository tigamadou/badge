import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  InvalidCursorError,
  NOTIFICATIONS_PAGE_SIZE,
  countUnread,
  listNotifications,
  markAllRead,
  markRead,
  toNotificationDTO,
} from "../queries";
import { makeNotification, makeUser } from "./helpers";

describe("queries", () => {
  it("la portée org inclut ORG et EVENT de cette org, pas ceux d'une autre org", async () => {
    const u = await makeUser();
    const a = await makeNotification(u.id, { scope: "ORG", orgId: "o1" });
    const b = await makeNotification(u.id, { scope: "EVENT", orgId: "o1", eventId: "e1" });
    await makeNotification(u.id, { scope: "ORG", orgId: "o2" });
    await makeNotification(u.id, { scope: "PLATFORM" });
    const { items } = await listNotifications(u.id, { kind: "org", orgId: "o1" });
    expect(items.map((i) => i.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("la portée event n'inclut que cet évènement", async () => {
    const u = await makeUser();
    const a = await makeNotification(u.id, { scope: "EVENT", orgId: "o1", eventId: "e1" });
    await makeNotification(u.id, { scope: "EVENT", orgId: "o1", eventId: "e2" });
    await makeNotification(u.id, { scope: "ORG", orgId: "o1" });
    const { items } = await listNotifications(u.id, { kind: "event", eventId: "e1" });
    expect(items.map((i) => i.id)).toEqual([a.id]);
  });

  it("platform et participant", async () => {
    const u = await makeUser();
    const other = await makeUser();
    const p = await makeNotification(u.id, { scope: "PLATFORM" });
    const q = await makeNotification(u.id, { scope: "PARTICIPANT" });
    await makeNotification(other.id, { scope: "PLATFORM" });
    expect((await listNotifications(u.id, { kind: "platform" })).items.map((i) => i.id)).toEqual([p.id]);
    expect((await listNotifications(u.id, { kind: "participant" })).items.map((i) => i.id)).toEqual([q.id]);
  });

  it("pagine par curseur sans doublon ni trou", async () => {
    const u = await makeUser();
    const base = Date.now();
    const created = [];
    for (let i = 0; i < 25; i++) {
      created.push(await makeNotification(u.id, { createdAt: new Date(base - i * 1000) }));
    }
    const first = await listNotifications(u.id, { kind: "platform" });
    expect(first.items).toHaveLength(NOTIFICATIONS_PAGE_SIZE);
    expect(first.nextCursor).not.toBeNull();
    const second = await listNotifications(u.id, { kind: "platform" }, { cursor: first.nextCursor! });
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    expect([...first.items, ...second.items].map((i) => i.id)).toEqual(created.map((c) => c.id));
  });

  it("limit borne la page", async () => {
    const u = await makeUser();
    for (let i = 0; i < 3; i++) await makeNotification(u.id);
    const r = await listNotifications(u.id, { kind: "platform" }, { limit: 2 });
    expect(r.items).toHaveLength(2);
    expect(r.nextCursor).not.toBeNull();
  });

  it("unreadOnly ne renvoie que les non lues", async () => {
    const u = await makeUser();
    const unread = await makeNotification(u.id);
    await makeNotification(u.id, { readAt: new Date() });
    const { items } = await listNotifications(u.id, { kind: "platform" }, { unreadOnly: true });
    expect(items.map((i) => i.id)).toEqual([unread.id]);
  });

  it("un curseur d'un autre utilisateur ou inconnu lève InvalidCursorError", async () => {
    const u = await makeUser();
    const other = await makeUser();
    const foreign = await makeNotification(other.id);
    await expect(listNotifications(u.id, { kind: "platform" }, { cursor: foreign.id })).rejects.toBeInstanceOf(InvalidCursorError);
    await expect(listNotifications(u.id, { kind: "platform" }, { cursor: "inconnu" })).rejects.toBeInstanceOf(InvalidCursorError);
  });

  it("countUnread compte les non lues de la portée", async () => {
    const u = await makeUser();
    await makeNotification(u.id);
    await makeNotification(u.id);
    await makeNotification(u.id, { readAt: new Date() });
    await makeNotification(u.id, { scope: "PARTICIPANT" });
    expect(await countUnread(u.id, { kind: "platform" })).toBe(2);
  });

  it("markRead renvoie false pour la notification d'un autre utilisateur et ne la modifie pas", async () => {
    const u = await makeUser();
    const other = await makeUser();
    const n = await makeNotification(other.id);
    expect(await markRead(u.id, n.id)).toBe(false);
    expect(await markRead(u.id, "inconnue")).toBe(false);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: n.id } })).readAt).toBeNull();
  });

  it("markRead marque lue et ne réécrit pas readAt", async () => {
    const u = await makeUser();
    const n = await makeNotification(u.id);
    expect(await markRead(u.id, n.id)).toBe(true);
    const first = (await prisma.notification.findUniqueOrThrow({ where: { id: n.id } })).readAt!;
    expect(first).not.toBeNull();
    await new Promise((r) => setTimeout(r, 20));
    expect(await markRead(u.id, n.id)).toBe(true);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: n.id } })).readAt).toEqual(first);
  });

  it("markAllRead ne touche que la portée et l'utilisateur", async () => {
    const u = await makeUser();
    const other = await makeUser();
    await makeNotification(u.id);
    await makeNotification(u.id);
    const outScope = await makeNotification(u.id, { scope: "PARTICIPANT" });
    const foreign = await makeNotification(other.id);
    expect(await markAllRead(u.id, { kind: "platform" })).toBe(2);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: outScope.id } })).readAt).toBeNull();
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: foreign.id } })).readAt).toBeNull();
    expect(await markAllRead(u.id, { kind: "platform" })).toBe(0);
  });

  it("toNotificationDTO renvoie links [] si la colonne est nulle ou mal formée", async () => {
    const u = await makeUser();
    const ok = await makeNotification(u.id);
    const dto = toNotificationDTO(ok);
    expect(Object.keys(dto).sort()).toEqual(
      ["body", "createdAt", "href", "id", "links", "readAt", "title", "type"],
    );
    expect(dto.links).toEqual([{ label: "A", href: "/a" }]);
    expect(dto.readAt).toBeNull();
    expect(typeof dto.createdAt).toBe("string");
    expect(toNotificationDTO({ ...ok, links: null }).links).toEqual([]);
    expect(toNotificationDTO({ ...ok, links: "oops" }).links).toEqual([]);
    expect(toNotificationDTO({ ...ok, links: [{ label: 1 }, { label: "B", href: "/b" }] }).links).toEqual([
      { label: "B", href: "/b" },
    ]);
    expect(toNotificationDTO({ ...ok, links: [null] }).links).toEqual([]);
    expect(
      toNotificationDTO({ ...ok, links: [{ label: "A", href: "/a", anchor: "Awa" }, { label: "B", href: "/b", anchor: 3 }, { label: "C", href: "/c", anchor: "" }] }).links,
    ).toEqual([{ label: "A", href: "/a", anchor: "Awa" }, { label: "B", href: "/b" }, { label: "C", href: "/c" }]);
    expect(toNotificationDTO({ ...ok, readAt: new Date("2026-01-01T00:00:00Z") }).readAt).toBe("2026-01-01T00:00:00.000Z");
  });
});
