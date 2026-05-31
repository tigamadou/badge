import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { findDuplicatesForRegistration } from "@/lib/duplicates";

afterAll(async () => {
  await prisma.registration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
});

async function mkOrgEvt() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${stamp}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-${stamp}`, location: "", date: new Date() },
  });
  const cat = await prisma.category.create({
    data: { eventId: event.id, name: "V", color: "#000", number: 1 },
  });
  return { org, event, cat };
}

async function mkReg(
  eventId: string,
  categoryId: string,
  data: Partial<{ email: string; firstName: string; lastName: string; idDocumentNumber: string }>,
) {
  return prisma.registration.create({
    data: {
      id: `R-${Math.random().toString(36).slice(2, 12)}`,
      eventId,
      categoryId,
      email: data.email ?? `${Math.random().toString(36).slice(2, 8)}@x.test`,
      lastName: data.lastName ?? "L",
      firstName: data.firstName ?? "F",
      structure: "S",
      idDocumentType: "CNI",
      idDocumentNumber: data.idDocumentNumber ?? `D-${Math.random().toString(36).slice(2, 10)}`,
    },
  });
}

describe("findDuplicatesForRegistration", () => {
  beforeEach(async () => {
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
  });

  it("matches by same email (same event, different id)", async () => {
    const { event, cat } = await mkOrgEvt();
    const a = await mkReg(event.id, cat.id, { email: "x@y.test", firstName: "A" });
    const b = await mkReg(event.id, cat.id, { email: "x@y.test", firstName: "B" });
    const dups = await findDuplicatesForRegistration(a.id);
    expect(dups.map((d) => d.id)).toEqual([b.id]);
  });

  it("matches by same idDocumentNumber", async () => {
    const { event, cat } = await mkOrgEvt();
    const a = await mkReg(event.id, cat.id, { idDocumentNumber: "DOC-1" });
    const b = await mkReg(event.id, cat.id, { idDocumentNumber: "DOC-1" });
    const dups = await findDuplicatesForRegistration(a.id);
    expect(dups.map((d) => d.id)).toEqual([b.id]);
  });

  it("matches by same firstName+lastName combination", async () => {
    const { event, cat } = await mkOrgEvt();
    const a = await mkReg(event.id, cat.id, { firstName: "Amadou", lastName: "Diallo" });
    const b = await mkReg(event.id, cat.id, { firstName: "Amadou", lastName: "Diallo" });
    const dups = await findDuplicatesForRegistration(a.id);
    expect(dups.map((d) => d.id)).toEqual([b.id]);
  });

  it("does not return the registration itself", async () => {
    const { event, cat } = await mkOrgEvt();
    const a = await mkReg(event.id, cat.id, { email: "u@u.test" });
    const dups = await findDuplicatesForRegistration(a.id);
    expect(dups.map((d) => d.id)).not.toContain(a.id);
  });

  it("scopes to the same event only", async () => {
    const { event, cat } = await mkOrgEvt();
    const otherOrg = await prisma.organization.create({ data: { name: "B", slug: `b-o-${Date.now()}` } });
    const otherEvt = await prisma.event.create({
      data: { orgId: otherOrg.id, title: "E2", slug: `e2-${Date.now()}`, location: "", date: new Date() },
    });
    const otherCat = await prisma.category.create({
      data: { eventId: otherEvt.id, name: "V", color: "#000", number: 1 },
    });
    const a = await mkReg(event.id, cat.id, { email: "same@x.test" });
    await mkReg(otherEvt.id, otherCat.id, { email: "same@x.test" });
    const dups = await findDuplicatesForRegistration(a.id);
    expect(dups).toHaveLength(0);
  });

  it("returns empty array when registration unknown", async () => {
    const dups = await findDuplicatesForRegistration("missing");
    expect(dups).toEqual([]);
  });
});
