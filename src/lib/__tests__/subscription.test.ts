import { describe, it, expect, afterEach } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  resolveOrgLimits,
  assertCanCreateEvent,
  assertCanRegister,
} from "@/lib/subscription";

async function makeOrgWithPlan(opts: {
  slug: string;
  maxEvents?: number | null;
  maxParticipantsPerEvent?: number | null;
  status?: "ACTIVE" | "EXPIRED" | "CANCELLED";
  endDate?: Date | null;
  overrideMaxEvents?: number | null;
  overrideMaxParticipantsPerEvent?: number | null;
}) {
  const org = await prisma.organization.create({ data: { name: opts.slug, slug: opts.slug } });
  const plan = await prisma.plan.create({
    data: {
      name: `plan-${opts.slug}`,
      maxEvents: opts.maxEvents ?? null,
      maxParticipantsPerEvent: opts.maxParticipantsPerEvent ?? null,
    },
  });
  await prisma.subscription.create({
    data: {
      orgId: org.id,
      planId: plan.id,
      status: opts.status ?? "ACTIVE",
      endDate: opts.endDate ?? null,
      overrideMaxEvents: opts.overrideMaxEvents ?? null,
      overrideMaxParticipantsPerEvent: opts.overrideMaxParticipantsPerEvent ?? null,
    },
  });
  return org;
}

let regCounter = 0;
async function createRegistration(eventId: string, categoryId: string) {
  const user = await prisma.user.create({
    data: { email: `r${regCounter}-${eventId}@x`, password: "x", name: "U" },
  });
  regCounter += 1;
  return prisma.registration.create({
    data: {
      id: `reg-${eventId}-${regCounter}`,
      eventId,
      categoryId,
      userId: user.id,
      status: "PENDING",
      snapshotFirstName: "F",
      snapshotLastName: "L",
      snapshotEmail: user.email,
      snapshotStructure: "S",
      snapshotPhoto: "",
      snapshotIdDocumentType: "CNI",
      snapshotIdDocumentNumber: "123",
      snapshotIdDocument: "",
    },
  });
}

describe("resolveOrgLimits", () => {
  it("inherits plan limits when no override", async () => {
    const org = await makeOrgWithPlan({ slug: "o1", maxEvents: 5, maxParticipantsPerEvent: 50 });
    expect(await resolveOrgLimits(org.id)).toEqual({
      maxEvents: 5,
      maxParticipantsPerEvent: 50,
      active: true,
    });
  });

  it("override wins over the plan value", async () => {
    const org = await makeOrgWithPlan({
      slug: "o2",
      maxEvents: 5,
      maxParticipantsPerEvent: 50,
      overrideMaxEvents: 20,
    });
    const l = await resolveOrgLimits(org.id);
    expect(l.maxEvents).toBe(20);
    expect(l.maxParticipantsPerEvent).toBe(50);
  });

  it("expired endDate => inactive", async () => {
    const org = await makeOrgWithPlan({
      slug: "o3",
      maxEvents: 5,
      maxParticipantsPerEvent: 50,
      endDate: new Date(Date.now() - 1000),
    });
    expect((await resolveOrgLimits(org.id)).active).toBe(false);
  });

  it("CANCELLED status => inactive", async () => {
    const org = await makeOrgWithPlan({ slug: "o4", status: "CANCELLED", maxEvents: 5 });
    expect((await resolveOrgLimits(org.id)).active).toBe(false);
  });

  it("no subscription => inactive", async () => {
    const org = await prisma.organization.create({ data: { name: "ns", slug: "ns" } });
    expect((await resolveOrgLimits(org.id)).active).toBe(false);
  });
});

describe("assertCanCreateEvent", () => {
  it("throws EVENT_LIMIT when the event count is reached", async () => {
    const org = await makeOrgWithPlan({ slug: "e1", maxEvents: 1, maxParticipantsPerEvent: 100 });
    await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "e1-evt", location: "x", date: new Date() },
    });
    await expect(assertCanCreateEvent(org.id)).rejects.toMatchObject({ code: "EVENT_LIMIT" });
  });

  it("passes when under the limit", async () => {
    const org = await makeOrgWithPlan({ slug: "e2", maxEvents: 5, maxParticipantsPerEvent: 100 });
    await expect(assertCanCreateEvent(org.id)).resolves.toBeUndefined();
  });

  it("null maxEvents never blocks", async () => {
    const org = await makeOrgWithPlan({ slug: "e3", maxEvents: null, maxParticipantsPerEvent: 100 });
    for (let i = 0; i < 3; i += 1) {
      await prisma.event.create({
        data: { orgId: org.id, title: "E", slug: `e3-${i}`, location: "x", date: new Date() },
      });
    }
    await expect(assertCanCreateEvent(org.id)).resolves.toBeUndefined();
  });

  it("throws SUBSCRIPTION_INACTIVE when expired", async () => {
    const org = await makeOrgWithPlan({ slug: "e4", status: "EXPIRED", maxEvents: 5 });
    await expect(assertCanCreateEvent(org.id)).rejects.toMatchObject({ code: "SUBSCRIPTION_INACTIVE" });
  });
});

describe("assertCanRegister", () => {
  it("throws PARTICIPANT_LIMIT when the event is full (per event)", async () => {
    const org = await makeOrgWithPlan({ slug: "r1", maxEvents: 10, maxParticipantsPerEvent: 1 });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "r1-evt", location: "x", date: new Date() },
    });
    const cat = await prisma.category.create({
      data: { eventId: event.id, name: "C", color: "#000000", number: 1 },
    });
    await createRegistration(event.id, cat.id);
    await expect(assertCanRegister(event.id)).rejects.toMatchObject({ code: "PARTICIPANT_LIMIT" });
  });

  it("passes when under the per-event limit", async () => {
    const org = await makeOrgWithPlan({ slug: "r2", maxEvents: 10, maxParticipantsPerEvent: 5 });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "r2-evt", location: "x", date: new Date() },
    });
    await expect(assertCanRegister(event.id)).resolves.toBeUndefined();
  });

  it("throws SUBSCRIPTION_INACTIVE when the subscription is inactive", async () => {
    const org = await makeOrgWithPlan({
      slug: "r3",
      status: "CANCELLED",
      maxEvents: 10,
      maxParticipantsPerEvent: 5,
    });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "r3-evt", location: "x", date: new Date(Date.now() - 10 * 86_400_000) },
    });
    await expect(assertCanRegister(event.id)).rejects.toMatchObject({
      code: "SUBSCRIPTION_INACTIVE",
    });
  });

  it("returns without error when the event does not exist", async () => {
    await expect(assertCanRegister("nonexistent-event")).resolves.toBeUndefined();
  });

  it("null maxParticipantsPerEvent never blocks", async () => {
    const org = await makeOrgWithPlan({ slug: "r4", maxEvents: 10, maxParticipantsPerEvent: null });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "r4-evt", location: "x", date: new Date() },
    });
    await expect(assertCanRegister(event.id)).resolves.toBeUndefined();
  });
});

// --- Droits selon l'abonnement (matrice de la plateforme) ---

async function setRights(value: unknown) {
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    update: { subscriptionRights: value as never },
    create: { id: "singleton", subscriptionRights: value as never },
  });
}

const DAY = 86_400_000;

// PlatformSettings n'est pas vidé entre les tests : on remet les droits à neutre (la ligne reste).
afterEach(async () => {
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    update: { subscriptionRights: Prisma.DbNull },
    create: { id: "singleton" },
  });
});

async function makeEvent(orgId: string, slug: string, date: Date, endDate: Date | null = null) {
  return prisma.event.create({
    data: { orgId, title: "E", slug, location: "x", date, endDate },
  });
}

describe("assertCanRegister : droits selon l'abonnement", () => {
  it("expiré + évènement en cours : passe", async () => {
    const org = await makeOrgWithPlan({ slug: "ra1", status: "EXPIRED", maxEvents: 5 });
    const event = await makeEvent(org.id, "ra1-evt", new Date(Date.now() + DAY));
    await expect(assertCanRegister(event.id)).resolves.toBeUndefined();
  });

  it("expiré + évènement terminé : SUBSCRIPTION_INACTIVE", async () => {
    const org = await makeOrgWithPlan({ slug: "ra2", status: "EXPIRED", maxEvents: 5 });
    const event = await makeEvent(org.id, "ra2-evt", new Date(Date.now() - 10 * DAY));
    await expect(assertCanRegister(event.id)).rejects.toMatchObject({ code: "SUBSCRIPTION_INACTIVE" });
  });

  it("expiré + évènement archivé : SUBSCRIPTION_INACTIVE", async () => {
    const org = await makeOrgWithPlan({ slug: "ra2b", status: "EXPIRED", maxEvents: 5 });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "ra2b-evt", location: "x", date: new Date(Date.now() + DAY), archived: true },
    });
    await expect(assertCanRegister(event.id)).rejects.toMatchObject({ code: "SUBSCRIPTION_INACTIVE" });
  });

  it("expiré + RECEIVE_REGISTRATIONS.inactive = false : refus même en cours", async () => {
    await setRights({ RECEIVE_REGISTRATIONS: { inactive: false } });
    const org = await makeOrgWithPlan({ slug: "ra3", status: "EXPIRED", maxEvents: 5 });
    const event = await makeEvent(org.id, "ra3-evt", new Date(Date.now() + DAY));
    await expect(assertCanRegister(event.id)).rejects.toMatchObject({ code: "SUBSCRIPTION_INACTIVE" });
  });

  it("actif + RECEIVE_REGISTRATIONS.active = false : refus", async () => {
    await setRights({ RECEIVE_REGISTRATIONS: { active: false } });
    const org = await makeOrgWithPlan({ slug: "ra4", maxEvents: 5 });
    const event = await makeEvent(org.id, "ra4-evt", new Date(Date.now() + DAY));
    await expect(assertCanRegister(event.id)).rejects.toMatchObject({ code: "SUBSCRIPTION_INACTIVE" });
  });
});

describe("assertCanCreateEvent : droits selon l'abonnement", () => {
  it("expiré : refus par défaut", async () => {
    const org = await makeOrgWithPlan({ slug: "ca1", status: "EXPIRED", maxEvents: 5 });
    await expect(assertCanCreateEvent(org.id)).rejects.toMatchObject({ code: "SUBSCRIPTION_INACTIVE" });
  });

  it("expiré + CREATE_EVENT.inactive = true : accepté", async () => {
    await setRights({ CREATE_EVENT: { inactive: true } });
    const org = await makeOrgWithPlan({ slug: "ca2", status: "EXPIRED", maxEvents: 5 });
    await expect(assertCanCreateEvent(org.id)).resolves.toBeUndefined();
  });

  it("expiré + CREATE_EVENT.inactive = true : le quota maxEvents s'applique toujours", async () => {
    await setRights({ CREATE_EVENT: { inactive: true } });
    const org = await makeOrgWithPlan({ slug: "ca3", status: "EXPIRED", maxEvents: 1 });
    await makeEvent(org.id, "ca3-evt", new Date(Date.now() + DAY));
    await expect(assertCanCreateEvent(org.id)).rejects.toMatchObject({ code: "EVENT_LIMIT" });
  });

  it("actif + CREATE_EVENT.active = false : refus", async () => {
    await setRights({ CREATE_EVENT: { active: false } });
    const org = await makeOrgWithPlan({ slug: "ca4", maxEvents: 5 });
    await expect(assertCanCreateEvent(org.id)).rejects.toMatchObject({ code: "SUBSCRIPTION_INACTIVE" });
  });
});
