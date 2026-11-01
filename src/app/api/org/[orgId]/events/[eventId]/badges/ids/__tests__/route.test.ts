import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

async function seedEvent(role: "ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER") {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const u = await prisma.user.create({
    data: { email: `u-${stamp}@x.test`, password: "x", name: "U", emailVerifiedAt: new Date() },
  });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-ids-${stamp}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-ids-${stamp}`, location: "L", date: new Date() },
  });
  await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role } });
  const category = await prisma.category.create({
    data: { eventId: event.id, name: "V1", color: "#000000", number: 1 },
  });
  return { u, org, event, category };
}

type Spec = { status?: "PENDING" | "APPROVED" | "REJECTED"; printed?: boolean; allAccess?: boolean; last?: string };

// Insertion en masse : `count` inscriptions, personnalisables par index.
async function seedMany(eventId: string, categoryId: string, count: number, spec: (i: number) => Spec = () => ({})) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await prisma.user.createMany({
    data: Array.from({ length: count }, (_, i) => ({ email: `ids-${stamp}-${i}@x.test`, password: "x", name: "B" })),
  });
  const users = await prisma.user.findMany({ where: { email: { startsWith: `ids-${stamp}-` } }, select: { id: true, email: true } });
  const byEmail = new Map(users.map((x) => [x.email, x.id]));
  const ids = Array.from({ length: count }, (_, i) => `I-${stamp}-${String(i).padStart(5, "0")}`);
  await prisma.registration.createMany({
    data: ids.map((id, i) => {
      const s = spec(i);
      return {
        id,
        eventId,
        categoryId,
        userId: byEmail.get(`ids-${stamp}-${i}@x.test`)!,
        status: s.status ?? ("APPROVED" as const),
        badgePrinted: s.printed ?? false,
        allAccessGranted: s.allAccess ?? false,
        snapshotEmail: `ids-${stamp}-${i}@x.test`,
        snapshotFirstName: "Awa",
        snapshotLastName: s.last ?? `Nom${String(i).padStart(5, "0")}`,
        snapshotStructure: "S",
        snapshotPhoto: "p",
        snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: `D${i}`,
        snapshotIdDocument: "d",
      };
    }),
  });
  return ids;
}

async function callGet(orgId: string, eventId: string, query = "") {
  const { GET } = await import("../route");
  return GET(new NextRequest(`http://localhost/x${query}`), { params: Promise.resolve({ orgId, eventId }) });
}

describe("GET /badges/ids", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("renvoie les 1 200 ids sans troncature", async () => {
    const { u, org, event, category } = await seedEvent("PRINTER");
    const ids = await seedMany(event.id, category.id, 1200);
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const res = await callGet(org.id, event.id);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ids).toHaveLength(1200);
    expect(new Set(json.ids)).toEqual(new Set(ids));
  }, 60_000);

  it("ne renvoie que les APPROVED correspondant aux filtres, rien d'un autre evenement", async () => {
    const a = await seedEvent("ADMIN");
    const b = await seedEvent("ADMIN");
    const other = await prisma.category.create({ data: { eventId: a.event.id, name: "V2", color: "#111111", number: 2 } });
    await seedMany(a.event.id, a.category.id, 12, (i) => ({
      status: i < 2 ? "PENDING" : i === 2 ? "REJECTED" : "APPROVED",
      printed: i >= 3 && i < 6,
      allAccess: i === 6,
      last: i === 7 ? "Zorro" : undefined,
    }));
    const inOther = await seedMany(a.event.id, other.id, 2);
    await seedMany(b.event.id, b.category.id, 4);
    withSession({ id: a.u.id, email: a.u.email, name: a.u.name, isStaff: false });

    const count = async (q: string) => (await (await callGet(a.org.id, a.event.id, q)).json()).ids.length;
    expect(await count("")).toBe(11); // 9 approuvees + 2 autre categorie
    expect(await count("?filter=printed")).toBe(3);
    expect(await count("?filter=unprinted")).toBe(8);
    expect(await count("?filter=allaccess")).toBe(1);
    expect(await count("?q=zorro")).toBe(1);
    expect((await (await callGet(a.org.id, a.event.id, `?categoryId=${other.id}`)).json()).ids.sort()).toEqual([...inOther].sort());
    expect(await count(`?categoryId=${b.category.id}`)).toBe(0);
  });

  it("VIEWER -> 403, non authentifie -> 401", async () => {
    const { u, org, event } = await seedEvent("VIEWER");
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    expect((await callGet(org.id, event.id)).status).toBe(403);
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await callGet(org.id, event.id)).status).toBe(401);
  });
});
