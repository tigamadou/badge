import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeOverride, makeUser, seedFactories } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { GET as getProfile, PUT as putProfile } from "@/app/api/account/profile/route";
import { POST as upload } from "@/app/api/account/upload/route";
import { POST as resubmit } from "@/app/api/account/registrations/[id]/resubmit/route";
import { POST as register } from "@/app/api/events/[slug]/register/route";

beforeEach(() => {
  seedFactories(81);
  vi.mocked(getServerSession).mockReset();
});

type Acting = { id: string; email: string; name: string };
const as = (u: Acting) => vi.mocked(getServerSession).mockResolvedValue({ user: { ...u, isStaff: false } } as never);

const put = () =>
  putProfile(new NextRequest("http://localhost/api/account/profile", { method: "PUT", body: "{}", headers: { "content-type": "application/json" } }));
const get = () => getProfile(new NextRequest("http://localhost/api/account/profile"));
const up = () => upload(new NextRequest("http://localhost/api/account/upload", { method: "POST", body: new FormData() }));
const resub = () =>
  resubmit(new NextRequest("http://localhost/api/account/registrations/x/resubmit", { method: "POST" }), { params: Promise.resolve({ id: "x" }) });
const reg = () =>
  register(new NextRequest("http://localhost/api/events/e/register", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }), {
    params: Promise.resolve({ slug: "e" }),
  });

const routes = { put, up, resub, reg };

describe("routes participant : garde par permission", () => {
  it("compte actif : les quatre routes passent le garde", async () => {
    const u = await makeUser();
    as(u);
    for (const call of Object.values(routes)) {
      const status = (await call()).status;
      expect([401, 403]).not.toContain(status);
    }
  });

  it("compte archivé avec session valide : refus 401 partout, la lecture du profil aussi", async () => {
    const u = await makeUser({ archived: true });
    as(u);
    for (const call of Object.values(routes)) expect((await call()).status).toBe(401);
  });

  it("compte bloqué : refus 403 ACCOUNT_BLOCKED partout", async () => {
    const u = await makeUser({ blocked: true });
    as(u);
    for (const call of Object.values(routes)) {
      const res = await call();
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe("ACCOUNT_BLOCKED");
    }
  });

  it("sans session : 401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    for (const call of Object.values(routes)) expect((await call()).status).toBe(401);
  });

  it.each([
    ["registration.self.create", "reg"],
    ["registration.self.resubmit", "resub"],
    ["account.profile.upload", "up"],
    ["account.profile.update", "put"],
  ] as const)("REVOKE de %s : seule la route concernée est refusée, la lecture du profil reste permise", async (permission, name) => {
    const u = await makeUser();
    await makeOverride({ userId: u.id, permission, effect: "REVOKE" });
    as(u);
    for (const [key, call] of Object.entries(routes)) {
      const status = (await call()).status;
      if (key === name) expect(status).toBe(403);
      else expect(status).not.toBe(403);
    }
    expect((await get()).status).toBe(200);
  });

  it("l'ajustement d'un autre compte n'affecte pas ce compte", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    await makeOverride({ userId: a.id, permission: "registration.self.create", effect: "REVOKE" });
    as(b);
    expect((await reg()).status).not.toBe(403);
    expect(await prisma.userPermissionOverride.count({ where: { userId: b.id } })).toBe(0);
  });
});
