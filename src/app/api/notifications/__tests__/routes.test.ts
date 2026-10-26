import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeNotification, makeUser, sessionOf } from "@/lib/notifications/__tests__/helpers";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

import { GET as list } from "../route";
import { GET as unreadCount } from "../unread-count/route";
import { POST as read } from "../[id]/read/route";
import { POST as readAll } from "../read-all/route";

beforeEach(() => vi.mocked(getServerSession).mockReset());

function login(u: { id: string; email: string; name: string }) {
  vi.mocked(getServerSession).mockResolvedValue(sessionOf({ ...u, isStaff: false }) as never);
}
const req = (path: string, method = "GET") => new NextRequest(`http://localhost/api/notifications${path}`, { method });

describe("API notifications", () => {
  it("401 sans session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await list(req("?scope=platform"))).status).toBe(401);
    expect((await unreadCount(req("/unread-count?scope=platform"))).status).toBe(401);
    expect((await read(req("/x/read", "POST"), { params: Promise.resolve({ id: "x" }) })).status).toBe(401);
    expect((await readAll(req("/read-all?scope=platform", "POST"))).status).toBe(401);
  });

  it("400 INVALID_SCOPE pour une portée inconnue ou org sans orgId", async () => {
    const u = await makeUser();
    login(u);
    for (const q of ["?scope=foo", "?scope=org", ""]) {
      const res = await list(req(q));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ code: "INVALID_SCOPE", error: "Portée invalide." });
    }
    expect((await unreadCount(req("/unread-count?scope=foo"))).status).toBe(400);
    expect((await readAll(req("/read-all?scope=event", "POST"))).status).toBe(400);
  });

  it("400 INVALID_CURSOR pour un curseur inconnu", async () => {
    const u = await makeUser();
    login(u);
    const res = await list(req("?scope=platform&cursor=inconnu"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: "INVALID_CURSOR", error: "Curseur invalide." });
  });

  it("limit=10 renvoie au plus 10 éléments ; limit=0, limit=abc ou limit=21 renvoie 400", async () => {
    const u = await makeUser();
    for (let i = 0; i < 12; i++) await makeNotification(u.id);
    login(u);
    const ok = await (await list(req("?scope=platform&limit=10"))).json();
    expect(ok.items).toHaveLength(10);
    expect(ok.nextCursor).not.toBeNull();
    for (const bad of ["0", "abc", "21", "1.5"]) {
      const res = await list(req(`?scope=platform&limit=${bad}`));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ code: "VALIDATION", error: "Paramètre limit invalide." });
    }
  });

  it("GET liste les notifications de la portée, avec nextCursor, et filtre les non lues", async () => {
    const u = await makeUser();
    const other = await makeUser();
    const base = Date.now();
    for (let i = 0; i < 21; i++) await makeNotification(u.id, { createdAt: new Date(base - i * 1000) });
    await makeNotification(u.id, { scope: "PARTICIPANT" });
    await makeNotification(other.id);
    login(u);
    const res = await list(req("?scope=platform"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(20);
    expect(Object.keys(body.items[0]).sort()).toEqual(
      ["body", "createdAt", "href", "id", "links", "readAt", "title", "type"],
    );
    const page2 = await (await list(req(`?scope=platform&cursor=${body.nextCursor}`))).json();
    expect(page2.items).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
    await prisma.notification.updateMany({ where: { userId: u.id }, data: { readAt: new Date() } });
    const unread = await (await list(req("?scope=platform&unread=1"))).json();
    expect(unread.items).toHaveLength(0);
  });

  it("GET unread-count renvoie le compte", async () => {
    const u = await makeUser();
    await makeNotification(u.id);
    await makeNotification(u.id, { readAt: new Date() });
    login(u);
    const res = await unreadCount(req("/unread-count?scope=platform"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 1 });
  });

  it("POST read sur la notification d'un autre utilisateur renvoie 404 et ne la modifie pas", async () => {
    const u = await makeUser();
    const other = await makeUser();
    const n = await makeNotification(other.id);
    login(u);
    const res = await read(req(`/${n.id}/read`, "POST"), { params: Promise.resolve({ id: n.id }) });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: "NOT_FOUND", error: "Notification introuvable." });
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: n.id } })).readAt).toBeNull();
  });

  it("POST read marque lue ; POST read-all renvoie le nombre marqué", async () => {
    const u = await makeUser();
    const n = await makeNotification(u.id);
    await makeNotification(u.id);
    await makeNotification(u.id);
    login(u);
    const res = await read(req(`/${n.id}/read`, "POST"), { params: Promise.resolve({ id: n.id }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const all = await readAll(req("/read-all?scope=platform", "POST"));
    expect(all.status).toBe(200);
    expect(await all.json()).toEqual({ updated: 2 });
  });

  it("les erreurs inattendues sont propagées", async () => {
    const u = await makeUser();
    login(u);
    const spy = vi.spyOn(prisma.notification, "count").mockRejectedValueOnce(new Error("db"));
    await expect(unreadCount(req("/unread-count?scope=platform"))).rejects.toThrow("db");
    spy.mockRestore();
    const spy2 = vi.spyOn(prisma.notification, "findFirst").mockRejectedValueOnce(new Error("db"));
    await expect(read(req("/x/read", "POST"), { params: Promise.resolve({ id: "x" }) })).rejects.toThrow("db");
    spy2.mockRestore();
    const spy3 = vi.spyOn(prisma.notification, "findMany").mockRejectedValueOnce(new Error("db"));
    await expect(list(req("?scope=platform"))).rejects.toThrow("db");
    spy3.mockRestore();
    const spy4 = vi.spyOn(prisma.notification, "updateMany").mockRejectedValueOnce(new Error("db"));
    await expect(readAll(req("/read-all?scope=platform", "POST"))).rejects.toThrow("db");
    spy4.mockRestore();
  });
});
