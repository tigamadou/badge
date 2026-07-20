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

async function callGet(orgId: string, eventId: string) {
  const { GET } = await import("../route");
  return GET(new NextRequest("http://localhost/x"), {
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
});
