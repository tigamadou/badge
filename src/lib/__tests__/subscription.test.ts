import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  resolveOrgLimits,
  assertCanCreateEvent,
  assertCanRegister,
  subscriptionDatesForPlan,
  DEFAULT_PLAN_NAME,
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
      data: { orgId: org.id, title: "E", slug: "r3-evt", location: "x", date: new Date() },
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


describe("subscriptionDatesForPlan", () => {
  const from = new Date("2026-01-01T00:00:00.000Z");

  it("plan free : sans echeance (endDate null), startDate = from", () => {
    const { startDate, endDate } = subscriptionDatesForPlan(
      { name: DEFAULT_PLAN_NAME, period: "MONTHLY" },
      from,
    );
    expect(startDate).toEqual(from);
    expect(endDate).toBeNull();
  });

  it("plan payant mensuel : endDate = from + 30 jours", () => {
    const { startDate, endDate } = subscriptionDatesForPlan({ name: "Pro", period: "MONTHLY" }, from);
    expect(startDate).toEqual(from);
    expect(endDate).toEqual(new Date("2026-01-31T00:00:00.000Z"));
  });
});
