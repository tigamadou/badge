import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { countCountableRegistrations, assertQuotaAvailable, QuotaError } from "@/lib/event-quota";

afterAll(async () => {
  await prisma.registration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
});

async function setup(quotaMax: number | null = null) {
  const org = await prisma.organization.create({
    data: {
      name: "Q",
      slug: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      quotaMaxRegistrations: quotaMax ?? undefined,
    },
  });
  const event = await prisma.event.create({
    data: {
      orgId: org.id,
      title: "E",
      slug: `q-evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      location: "",
      date: new Date(),
    },
  });
  const cat = await prisma.category.create({
    data: { eventId: event.id, name: "V", color: "#000", number: 1 },
  });
  return { org, event, cat };
}

async function mkReg(eventId: string, categoryId: string, status: "PENDING" | "APPROVED" | "REJECTED") {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const user = await prisma.user.create({
    data: {
      email: `q-${stamp}@x.test`,
      password: "x",
      name: "U",
      emailVerifiedAt: new Date(),
    },
  });
  return prisma.registration.create({
    data: {
      id: `R-${stamp}`,
      eventId,
      categoryId,
      userId: user.id,
      snapshotEmail: `${stamp}@x.test`,
      snapshotLastName: "L",
      snapshotFirstName: "F",
      snapshotStructure: "S",
      snapshotPhoto: "uploads/test/photo.jpg",
      snapshotIdDocumentType: "CNI",
      snapshotIdDocumentNumber: `D-${stamp}`,
      snapshotIdDocument: "uploads/test/doc.pdf",
      status,
    },
  });
}

describe("countCountableRegistrations", () => {
  beforeEach(async () => {
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
  });

  it("counts PENDING + APPROVED, ignores REJECTED", async () => {
    const { event, cat } = await setup();
    await mkReg(event.id, cat.id, "PENDING");
    await mkReg(event.id, cat.id, "APPROVED");
    await mkReg(event.id, cat.id, "APPROVED");
    await mkReg(event.id, cat.id, "REJECTED");
    await mkReg(event.id, cat.id, "REJECTED");

    const n = await countCountableRegistrations(event.id);
    expect(n).toBe(3);
  });

  it("returns 0 when no registration", async () => {
    const { event } = await setup();
    expect(await countCountableRegistrations(event.id)).toBe(0);
  });
});

describe("assertQuotaAvailable", () => {
  beforeEach(async () => {
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
  });

  it("passes when no quota set", async () => {
    const { event } = await setup(null);
    await expect(assertQuotaAvailable(event.id)).resolves.toBeUndefined();
  });

  it("passes when below quota", async () => {
    const { event, cat } = await setup(5);
    await mkReg(event.id, cat.id, "PENDING");
    await expect(assertQuotaAvailable(event.id)).resolves.toBeUndefined();
  });

  it("throws QuotaError when at quota", async () => {
    const { event, cat } = await setup(1);
    await mkReg(event.id, cat.id, "APPROVED");
    await expect(assertQuotaAvailable(event.id)).rejects.toBeInstanceOf(QuotaError);
  });

  it("rejected registrations do not consume quota", async () => {
    const { event, cat } = await setup(2);
    await mkReg(event.id, cat.id, "REJECTED");
    await mkReg(event.id, cat.id, "REJECTED");
    await mkReg(event.id, cat.id, "REJECTED");
    await expect(assertQuotaAvailable(event.id)).resolves.toBeUndefined();
  });
});
