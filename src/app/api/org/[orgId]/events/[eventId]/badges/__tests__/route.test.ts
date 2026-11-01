import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

async function mkParticipantUser(suffix: string) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${suffix}`;
  return prisma.user.create({
    data: {
      email: `p-${stamp}@x.test`,
      password: "x",
      name: "Participant",
      emailVerifiedAt: new Date(),
      firstName: "F",
      lastName: "L",
      structure: "S",
      photo: "uploads/test/photo.jpg",
      idDocumentType: "CNI",
      idDocumentNumber: `D-${stamp}`,
      idDocument: "uploads/test/doc.pdf",
      participantProfileCompletedAt: new Date(),
    },
  });
}

async function mkReg(
  eventId: string,
  categoryId: string,
  status: "PENDING" | "APPROVED" | "REJECTED",
) {
  const participant = await mkParticipantUser("badge");
  return prisma.registration.create({
    data: {
      id: `R-${Math.random().toString(36).slice(2, 12)}`,
      eventId,
      categoryId,
      userId: participant.id,
      snapshotEmail: participant.email,
      snapshotLastName: "L",
      snapshotFirstName: "F",
      snapshotStructure: "S",
      snapshotPhoto: "uploads/test/photo.jpg",
      snapshotIdDocumentType: "CNI",
      snapshotIdDocumentNumber: `D-${Math.random().toString(36).slice(2, 10)}`,
      snapshotIdDocument: "uploads/test/doc.pdf",
      status,
    },
  });
}

// PRINTER "pur" : membership event uniquement, aucune OrgMembership.
async function seedEvent(role: "ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER") {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const u = await prisma.user.create({
    data: { email: `u-${stamp}@x.test`, password: "x", name: "U", emailVerifiedAt: new Date() },
  });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-bg-${stamp}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-bg-${stamp}`, location: "L", date: new Date() },
  });
  await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role } });
  return { u, org, event };
}

async function callGet(orgId: string, eventId: string, query = "") {
  const { GET } = await import("../route");
  return GET(new NextRequest(`http://localhost/x${query}`), {
    params: Promise.resolve({ orgId, eventId }),
  });
}

describe("GET /badges", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("PRINTER pur obtient 200 et ne recoit que les APPROVED", async () => {
    const { u, org, event } = await seedEvent("PRINTER");
    const cat = await prisma.category.create({
      data: { eventId: event.id, name: "V1", color: "#000000", number: 1 },
    });
    await mkReg(event.id, cat.id, "APPROVED");
    await mkReg(event.id, cat.id, "PENDING");
    await mkReg(event.id, cat.id, "REJECTED");

    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const res = await callGet(org.id, event.id);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.registrations).toHaveLength(1);
    expect(json.registrations[0].category).toEqual({ name: "V1", color: "#000000", number: 1 });
  });

  it("le DTO n'expose ni email ni structure (moindre privilege)", async () => {
    const { u, org, event } = await seedEvent("PRINTER");
    const cat = await prisma.category.create({
      data: { eventId: event.id, name: "V1", color: "#000000", number: 1 },
    });
    await mkReg(event.id, cat.id, "APPROVED");

    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const res = await callGet(org.id, event.id);
    const json = await res.json();
    const row = json.registrations[0];

    expect(row).toHaveProperty("firstName");
    expect(row).toHaveProperty("lastName");
    expect(row).toHaveProperty("badgePrinted");
    expect(row).toHaveProperty("allAccessGranted");
    expect(row).not.toHaveProperty("email");
    expect(row).not.toHaveProperty("snapshotEmail");
    expect(row).not.toHaveProperty("structure");
    expect(row).not.toHaveProperty("snapshotStructure");
  });

  it("ADMIN obtient 200 (badge.print inclut ADMIN)", async () => {
    const { u, org, event } = await seedEvent("ADMIN");
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const res = await callGet(org.id, event.id);
    expect(res.status).toBe(200);
  });

  it("VIEWER obtient 403 (badge.print exclut VIEWER)", async () => {
    const { u, org, event } = await seedEvent("VIEWER");
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const res = await callGet(org.id, event.id);
    expect(res.status).toBe(403);
  });

  it("non authentifie -> 401", async () => {
    const { org, event } = await seedEvent("PRINTER");
    vi.mocked(getServerSession).mockResolvedValue(null as never);

    const res = await callGet(org.id, event.id);
    expect(res.status).toBe(401);
  });

  describe("pagination et filtres", () => {
    // Insertion en masse : 250 inscriptions approuvees (noms ordonnes, 40 imprimees, 10 all-access).
    async function seedMany(eventId: string, categoryId: string, count: number, withExtras = true) {
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const pad = (i: number) => String(i).padStart(4, "0");
      await prisma.user.createMany({
        data: Array.from({ length: count }, (_, i) => ({
          email: `bulk-${stamp}-${i}@x.test`,
          password: "x",
          name: "B",
        })),
      });
      const users = await prisma.user.findMany({
        where: { email: { startsWith: `bulk-${stamp}-` } },
        select: { id: true, email: true },
      });
      const byEmail = new Map(users.map((u) => [u.email, u.id]));
      await prisma.registration.createMany({
        data: Array.from({ length: count }, (_, i) => ({
          id: `B-${stamp}-${pad(i)}`,
          eventId,
          categoryId,
          userId: byEmail.get(`bulk-${stamp}-${i}@x.test`)!,
          status: "APPROVED" as const,
          badgePrinted: withExtras && i < 40,
          allAccessGranted: withExtras && i >= 40 && i < 50,
          snapshotEmail: `bulk-${stamp}-${i}@x.test`,
          snapshotFirstName: i % 2 === 0 ? "Awa" : "Zita",
          snapshotLastName: `Nom${pad(i)}`,
          snapshotStructure: "S",
          snapshotPhoto: "p",
          snapshotIdDocumentType: "CNI",
          snapshotIdDocumentNumber: `D${i}`,
          snapshotIdDocument: "d",
        })),
      });
    }

    it("renvoie le total exact et pagine 250 inscriptions en pages de 100", async () => {
      const { u, org, event } = await seedEvent("PRINTER");
      const cat = await prisma.category.create({ data: { eventId: event.id, name: "V1", color: "#000000", number: 1 } });
      await seedMany(event.id, cat.id, 250);
      withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

      const p1 = await (await callGet(org.id, event.id)).json();
      expect(p1.total).toBe(250);
      expect(p1.page).toBe(1);
      expect(p1.pageSize).toBe(100);
      expect(p1.registrations).toHaveLength(100);

      const p2 = await (await callGet(org.id, event.id, "?page=2")).json();
      const p3 = await (await callGet(org.id, event.id, "?page=3")).json();
      expect(p2.registrations).toHaveLength(100);
      expect(p3.registrations).toHaveLength(50);
      const names = [...p1.registrations, ...p2.registrations, ...p3.registrations].map((r: { lastName: string }) => r.lastName);
      expect(new Set(names).size).toBe(250);
      expect(names).toEqual([...names].sort());
    });

    it("borne pageSize a 500 et replie les valeurs invalides", async () => {
      const { u, org, event } = await seedEvent("PRINTER");
      const cat = await prisma.category.create({ data: { eventId: event.id, name: "V1", color: "#000000", number: 1 } });
      await seedMany(event.id, cat.id, 3, false);
      withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

      expect((await (await callGet(org.id, event.id, "?pageSize=9999")).json()).pageSize).toBe(500);
      expect((await (await callGet(org.id, event.id, "?pageSize=abc&page=-4")).json())).toMatchObject({ pageSize: 100, page: 1 });
      expect((await (await callGet(org.id, event.id, "?pageSize=0")).json()).pageSize).toBe(100);
      const small = await (await callGet(org.id, event.id, "?pageSize=2&page=2")).json();
      expect(small.registrations).toHaveLength(1);
      expect(small.total).toBe(3);
    });

    it("filtre imprime / non imprime / all-access, par categorie et par recherche", async () => {
      const { u, org, event } = await seedEvent("PRINTER");
      const cat = await prisma.category.create({ data: { eventId: event.id, name: "V1", color: "#000000", number: 1 } });
      const other = await prisma.category.create({ data: { eventId: event.id, name: "V2", color: "#111111", number: 2 } });
      await seedMany(event.id, cat.id, 250);
      const lone = await mkReg(event.id, other.id, "APPROVED");
      await prisma.registration.update({ where: { id: lone.id }, data: { snapshotFirstName: "Unique", snapshotLastName: "Zorro" } });
      withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

      const total = async (q: string) => (await (await callGet(org.id, event.id, q)).json()).total;
      expect(await total("")).toBe(251);
      expect(await total("?filter=all")).toBe(251);
      expect(await total("?filter=printed")).toBe(40);
      expect(await total("?filter=unprinted")).toBe(211);
      expect(await total("?filter=allaccess")).toBe(10);
      expect(await total("?filter=bogus")).toBe(251);
      expect(await total(`?categoryId=${other.id}`)).toBe(1);
      expect(await total(`?categoryId=${cat.id}&filter=printed`)).toBe(40);
      expect(await total("?q=zorro")).toBe(1);
      expect(await total("?q=Unique%20Zorro")).toBe(1);
      expect(await total("?q=Nom0007")).toBe(1);
      expect(await total("?q=introuvable")).toBe(0);
    });

    it("ignore les inscriptions d'un autre evenement", async () => {
      const a = await seedEvent("PRINTER");
      const b = await seedEvent("PRINTER");
      const catA = await prisma.category.create({ data: { eventId: a.event.id, name: "A", color: "#000000", number: 1 } });
      const catB = await prisma.category.create({ data: { eventId: b.event.id, name: "B", color: "#000000", number: 1 } });
      await seedMany(a.event.id, catA.id, 5, false);
      await seedMany(b.event.id, catB.id, 7, false);
      withSession({ id: a.u.id, email: a.u.email, name: a.u.name, isStaff: false });
      const json = await (await callGet(a.org.id, a.event.id, `?categoryId=${catB.id}`)).json();
      expect(json.total).toBe(0);
      expect((await (await callGet(a.org.id, a.event.id)).json()).total).toBe(5);
    });
  });
});
