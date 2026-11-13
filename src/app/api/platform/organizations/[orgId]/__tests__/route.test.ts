import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { makeStaff } from "@/test/factories";

function stamp() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function seedSuperAdmin() {
  const u = await makeStaff("SUPER_ADMIN", { emailVerifiedAt: new Date() });
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: u.id, email: u.email, name: u.name, isStaff: true },
  } as never);
  return u;
}

// Org avec un evenement, une categorie et une inscription : c'est la
// combinaison qui faisait echouer la cascade (Registration.categoryId en RESTRICT).
async function seedOrgWithRegistration() {
  const s = stamp();
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-del-${s}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-del-${s}`, location: "L", date: new Date() },
  });
  const category = await prisma.category.create({
    data: { eventId: event.id, name: "C", color: "#000000", number: 1 },
  });
  const participant = await prisma.user.create({
    data: { email: `p-del-${s}@x.test`, password: "x", name: "P", emailVerifiedAt: new Date() },
  });
  await prisma.registration.create({
    data: {
      id: `R-${Math.random().toString(36).slice(2, 12)}`,
      eventId: event.id,
      categoryId: category.id,
      userId: participant.id,
      snapshotEmail: participant.email,
      snapshotLastName: "L",
      snapshotFirstName: "F",
      snapshotStructure: "S",
      snapshotPhoto: "uploads/test/photo.jpg",
      snapshotIdDocumentType: "CNI",
      snapshotIdDocumentNumber: `D-${s}`,
      snapshotIdDocument: "uploads/test/doc.pdf",
      status: "APPROVED",
    },
  });
  return { org, event, category };
}

async function callDelete(orgId: string, confirmSlug?: string) {
  const { DELETE } = await import("../route");
  return DELETE(
    new NextRequest("http://localhost/x", {
      method: "DELETE",
      body: JSON.stringify(confirmSlug ? { confirmSlug } : {}),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ orgId }) },
  );
}

describe("DELETE /api/platform/organizations/[orgId]", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("supprime une organisation dont les evenements ont des inscriptions", async () => {
    await seedSuperAdmin();
    const { org, event, category } = await seedOrgWithRegistration();

    const res = await callDelete(org.id, org.slug);
    expect(res.status).toBe(204);

    expect(await prisma.organization.findUnique({ where: { id: org.id } })).toBeNull();
    expect(await prisma.event.findUnique({ where: { id: event.id } })).toBeNull();
    expect(await prisma.category.findUnique({ where: { id: category.id } })).toBeNull();
    expect(await prisma.registration.count({ where: { eventId: event.id } })).toBe(0);

    const log = await prisma.activityLog.findFirst({ where: { type: "ORG_DELETED", targetId: org.id } });
    expect(log).not.toBeNull();
  });

  it("refuse sans confirmation du slug et ne supprime rien", async () => {
    await seedSuperAdmin();
    const { org } = await seedOrgWithRegistration();

    const res = await callDelete(org.id);
    expect(res.status).toBe(400);
    expect(await prisma.organization.findUnique({ where: { id: org.id } })).not.toBeNull();
  });

  it("renvoie 404 pour une organisation inconnue", async () => {
    await seedSuperAdmin();
    const res = await callDelete("inconnue", "inconnue");
    expect(res.status).toBe(404);
  });
});
