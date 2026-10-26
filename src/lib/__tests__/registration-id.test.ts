import { describe, it, expect, beforeEach, vi } from "vitest";

import { prisma } from "@/lib/prisma";

vi.mock("@/lib/generate-id", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/generate-id")>();
  return { ...actual, generateId: vi.fn(actual.generateId) };
});
import { generateId } from "@/lib/generate-id";
import { allocateRegistrationId } from "@/lib/registration-id";

async function seed() {
  const org = await prisma.organization.create({ data: { name: "Org", slug: "org-regid" } });
  const event = await prisma.event.create({
    data: {
      orgId: org.id,
      title: "Event",
      slug: "regid-event",
      location: "L",
      date: new Date("2026-12-15"),
      registrationOpen: true,
    },
  });
  const cat3 = await prisma.category.create({
    data: { eventId: event.id, name: "Cat3", color: "#000000", number: 3 },
  });
  const cat12 = await prisma.category.create({
    data: { eventId: event.id, name: "Cat12", color: "#111111", number: 12 },
  });
  const user = await prisma.user.create({
    data: { email: "regid@test.test", password: "x", name: "U" },
  });
  return { event, cat3, cat12, user };
}

function registrationData(
  id: string,
  s: Awaited<ReturnType<typeof seed>>,
  categoryId: string,
  userId: string,
) {
  return {
    id,
    userId,
    eventId: s.event.id,
    categoryId,
    status: "PENDING" as const,
    snapshotFirstName: "A",
    snapshotLastName: "B",
    snapshotEmail: "regid@test.test",
    snapshotStructure: "S",
    snapshotPhoto: "/uploads/p.png",
    snapshotIdDocumentType: "CNI",
    snapshotIdDocumentNumber: "1",
    snapshotIdDocument: "/uploads/d.pdf",
  };
}

async function extraUser(n: number) {
  return prisma.user.create({
    data: { email: `regid-${n}@test.test`, password: "x", name: `U${n}` },
  });
}

describe("allocateRegistrationId", () => {
  beforeEach(() => {
    vi.mocked(generateId).mockClear();
  });

  it("uses the category number and the event date", async () => {
    const s = await seed();
    const id = await allocateRegistrationId(prisma, {
      eventId: s.event.id,
      eventDate: s.event.date,
      categoryId: s.cat12.id,
      categoryNumber: s.cat12.number,
    });
    expect(id[0]).toBe("2");
    expect(id[9]).toBe("2");
    expect(id.slice(1, 7)).toBe("261215");
  });

  it("counts only registrations of the target category for the sequential", async () => {
    const s = await seed();
    const u1 = await extraUser(1);
    const u2 = await extraUser(2);
    const u3 = await extraUser(3);
    await prisma.registration.create({ data: registrationData("c3-a", s, s.cat3.id, u1.id) });
    await prisma.registration.create({ data: registrationData("c3-b", s, s.cat3.id, u2.id) });
    await prisma.registration.create({ data: registrationData("c12-a", s, s.cat12.id, u3.id) });

    const id = await allocateRegistrationId(prisma, {
      eventId: s.event.id,
      eventDate: s.event.date,
      categoryId: s.cat12.id,
      categoryNumber: s.cat12.number,
    });
    expect(vi.mocked(generateId)).toHaveBeenCalledWith(
      expect.objectContaining({ categoryNumber: 12, sequentialNumber: 2 }),
    );
    expect(id.slice(-3)).toBe("002");
  });

  it("retries on collision until a free id is found", async () => {
    const s = await seed();
    await prisma.registration.create({ data: registrationData("collide-1", s, s.cat3.id, s.user.id) });
    vi.mocked(generateId).mockReturnValueOnce("collide-1").mockReturnValueOnce("fresh-2");

    // 1 inscription dans la categorie 3 -> sequentiel de base = 1
    const id = await allocateRegistrationId(prisma, {
      eventId: s.event.id,
      eventDate: s.event.date,
      categoryId: s.cat3.id,
      categoryNumber: s.cat3.number,
    });
    expect(id).toBe("fresh-2");
    expect(vi.mocked(generateId)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(generateId).mock.calls[1][0].sequentialNumber).toBe(1 + 2);
  });

  it("returns the last candidate after 5 failed retries", async () => {
    const s = await seed();
    await prisma.registration.create({ data: registrationData("taken", s, s.cat3.id, s.user.id) });
    vi.mocked(generateId).mockReturnValue("taken");

    const id = await allocateRegistrationId(prisma, {
      eventId: s.event.id,
      eventDate: s.event.date,
      categoryId: s.cat3.id,
      categoryNumber: s.cat3.number,
    });
    expect(id).toBe("taken");
    expect(vi.mocked(generateId)).toHaveBeenCalledTimes(6);
    vi.mocked(generateId).mockReset();
  });

  it("reads through the transaction client", async () => {
    const s = await seed();
    const id = await prisma.$transaction(async (tx) => {
      await tx.registration.create({ data: registrationData("in-tx-1", s, s.cat3.id, s.user.id) });
      vi.mocked(generateId).mockReturnValueOnce("in-tx-1").mockReturnValueOnce("in-tx-2");
      return allocateRegistrationId(tx, {
        eventId: s.event.id,
        eventDate: s.event.date,
        categoryId: s.cat3.id,
        categoryNumber: s.cat3.number,
      });
    });
    expect(id).toBe("in-tx-2");
  });
});
