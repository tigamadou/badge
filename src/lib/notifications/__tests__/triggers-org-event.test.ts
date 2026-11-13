import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { __mailTesting, type ResolvedTransport } from "@/lib/mail";
import { enqueueEmail } from "@/lib/jobs/enqueue-email";
import {
  notifyEventRegistrationToggled,
  notifyOrgCreated,
  notifyQuotaExceeded,
  notifySubscriptionChanged,
} from "../triggers";
import { addOrgMember, makeOrg, makeUser, seedTeam, sessionOf } from "./helpers";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

vi.mock("@/lib/mail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mail")>();
  return { ...actual, sendUserInvitation: vi.fn().mockResolvedValue(undefined) };
});

vi.mock("@/lib/jobs/enqueue-email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/jobs/enqueue-email")>()),
  enqueueEmail: vi.fn(async () => undefined),
}));

beforeEach(() => {
  vi.mocked(getServerSession).mockReset();
  vi.mocked(enqueueEmail).mockClear();
  __mailTesting.setResolveTransporter(
    async () =>
      ({ transporter: {}, from: "x@y", contactEmail: "", contactPhone: "", settings: {} }) as unknown as ResolvedTransport,
  );
});
afterEach(() => __mailTesting.reset());

function login(u: { id: string; email: string; name: string }, isStaff: boolean) {
  vi.mocked(getServerSession).mockResolvedValue(sessionOf({ ...u, isStaff }) as never);
}

function json(body: unknown, method = "POST") {
  return new NextRequest("http://localhost/x", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const idsOf = async (type: string) =>
  (await prisma.notification.findMany({ where: { type: type as never } })).map((r) => r.userId).sort();

describe("déclencheurs évènement", () => {
  async function patchRegistration(t: Awaited<ReturnType<typeof seedTeam>>, body: unknown) {
    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    return PATCH(json(body, "PATCH"), { params: Promise.resolve({ orgId: t.org.id, eventId: t.event.id }) });
  }

  it("ouvrir les inscriptions notifie les titulaires de event.read.aggregated (AUDITOR d'org compris, pas le PRINTER d'évènement), sauf l'auteur", async () => {
    const t = await seedTeam();
    await prisma.event.update({ where: { id: t.event.id }, data: { registrationOpen: false } });
    login(t.admin, false);
    expect((await patchRegistration(t, { registrationOpen: true })).status).toBe(200);
    expect(await idsOf("EVENT_REGISTRATION_OPENED")).toEqual(
      [t.owner.id, t.operator.id, t.viewer.id, t.auditor.id].sort(),
    );
    expect(vi.mocked(enqueueEmail)).toHaveBeenCalledTimes(4);
    expect(await idsOf("EVENT_REGISTRATION_OPENED")).not.toContain(t.printer.id);
    const row = await prisma.notification.findFirstOrThrow({ where: { userId: t.viewer.id } });
    expect(row).toMatchObject({ scope: "EVENT", eventId: t.event.id, orgId: t.org.id, title: "Inscriptions ouvertes" });
  });

  it("fermer les inscriptions envoie « Inscriptions fermées »", async () => {
    const t = await seedTeam();
    login(t.admin, false);
    expect((await patchRegistration(t, { registrationOpen: false })).status).toBe(200);
    const row = await prisma.notification.findFirstOrThrow({ where: { userId: t.operator.id } });
    expect(row.type).toBe("EVENT_REGISTRATION_CLOSED");
    expect(row.title).toBe("Inscriptions fermées");
  });

  it("un PATCH sans changement de registrationOpen ne notifie pas", async () => {
    const t = await seedTeam();
    login(t.admin, false);
    expect((await patchRegistration(t, { title: "Nouveau titre" })).status).toBe(200);
    expect((await patchRegistration(t, { registrationOpen: true })).status).toBe(200);
    expect(await prisma.notification.count()).toBe(0);
  });
});

describe("déclencheurs organisation et abonnement", () => {
  it("créer une org notifie STAFF_ADMIN et SUPER_ADMIN, pas STAFF_SUPPORT", async () => {
    const author = await makeUser({ staffRole: "STAFF_ADMIN" });
    const admin2 = await makeUser({ staffRole: "STAFF_ADMIN" });
    const sa = await makeUser({ staffRole: "SUPER_ADMIN" });
    await makeUser({ staffRole: "STAFF_SUPPORT" });
    login(author, true);
    const { POST } = await import("@/app/api/platform/organizations/route");
    const res = await POST(json({ name: "Nouvelle", ownerEmail: "o@x.test" }), { params: Promise.resolve({}) });
    expect(res.status).toBe(201);
    expect(await idsOf("ORG_CREATED")).toEqual([admin2.id, sa.id].sort());
    const row = await prisma.notification.findFirstOrThrow({ where: { type: "ORG_CREATED" } });
    expect(row.scope).toBe("PLATFORM");
    expect(row.href).toMatch(/^\/platform\/organizations\//);
  });

  async function putSubscription(orgId: string, planId: string) {
    const { PUT } = await import("@/app/api/platform/organizations/[orgId]/subscription/route");
    return PUT(json({ planId, status: "ACTIVE" }, "PUT"), { params: Promise.resolve({ orgId }) });
  }

  it("modifier l'abonnement notifie l'OWNER (portée ORG, lien /org/…/subscription) et le staff admin (portée PLATFORM)", async () => {
    const author = await makeUser({ staffRole: "STAFF_ADMIN" });
    const staff2 = await makeUser({ staffRole: "STAFF_ADMIN" });
    const org = await makeOrg("Acme");
    const owner = await makeUser();
    await addOrgMember(owner.id, org.id, "OWNER");
    const plan = await prisma.plan.create({ data: { name: "Pro-x" } });
    const sa = await makeUser({ staffRole: "SUPER_ADMIN" });
    login(author, true);
    expect((await putSubscription(org.id, plan.id)).status).toBe(200);
    const ownerRow = await prisma.notification.findFirstOrThrow({ where: { userId: owner.id } });
    expect(ownerRow).toMatchObject({
      type: "SUBSCRIPTION_CHANGED", scope: "ORG", orgId: org.id, href: `/org/${org.id}/subscription`,
    });
    expect(ownerRow.body).toContain("Pro-x");
    const staffRow = await prisma.notification.findFirstOrThrow({ where: { userId: staff2.id } });
    expect(staffRow).toMatchObject({ scope: "PLATFORM", href: `/platform/organizations/${org.id}/subscription` });
    expect(await prisma.notification.count({ where: { userId: author.id } })).toBe(0);
    // billing.subscription.pay n'est jamais porté par le staff non membre : le SUPER_ADMIN ne reçoit que la portée PLATFORM.
    const saRows = await prisma.notification.findMany({ where: { userId: sa.id } });
    expect(saRows.map((r) => r.scope)).toEqual(["PLATFORM"]);
  });

  it("un staff à la fois OWNER n'est notifié qu'une fois, en portée ORG", async () => {
    const author = await makeUser({ staffRole: "STAFF_ADMIN" });
    const both = await makeUser({ staffRole: "STAFF_ADMIN" });
    const org = await makeOrg("Acme");
    await addOrgMember(both.id, org.id, "OWNER");
    const plan = await prisma.plan.create({ data: { name: "Pro-y" } });
    login(author, true);
    expect((await putSubscription(org.id, plan.id)).status).toBe(200);
    const rows = await prisma.notification.findMany({ where: { userId: both.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].scope).toBe("ORG");
  });

  it("créer un évènement au-delà du quota par le staff notifie QUOTA_EXCEEDED ; sans dépassement, rien", async () => {
    const author = await makeUser({ staffRole: "STAFF_ADMIN" });
    const staff2 = await makeUser({ staffRole: "STAFF_ADMIN" });
    const org = await makeOrg("Acme");
    const owner = await makeUser();
    await addOrgMember(owner.id, org.id, "OWNER");
    const tight = await prisma.plan.create({ data: { name: "Tight", maxEvents: 0 } });
    const sub = await prisma.subscription.create({ data: { orgId: org.id, planId: tight.id, status: "ACTIVE" } });
    login(author, true);
    const { POST } = await import("@/app/api/org/[orgId]/events/route");
    const ctx = { params: Promise.resolve({ orgId: org.id }) };
    const res = await POST(json({ title: "Hors quota", date: "2026-12-01" }), ctx);
    expect(res.status).toBe(201);
    const { event } = await res.json();
    const ownerRow = await prisma.notification.findFirstOrThrow({ where: { userId: owner.id } });
    expect(ownerRow).toMatchObject({ type: "QUOTA_EXCEEDED", scope: "ORG", href: `/org/${org.id}/subscription` });
    expect(ownerRow.links).toEqual([
      { label: "Voir l'abonnement", href: `/org/${org.id}/subscription`, anchor: org.name },
      { label: "Voir l'évènement", href: `/event/${event.id}`, anchor: "Un évènement" },
    ]);
    const staffRow = await prisma.notification.findFirstOrThrow({ where: { userId: staff2.id } });
    expect(staffRow.scope).toBe("PLATFORM");

    await prisma.notification.deleteMany();
    await prisma.subscription.update({ where: { id: sub.id }, data: { overrideMaxEvents: 10 } });
    expect((await POST(json({ title: "Dans le quota", date: "2026-12-01" }), ctx)).status).toBe(201);
    expect(await prisma.notification.count()).toBe(0);
  });

  it("org ou évènement introuvable : aucun effet", async () => {
    const actor = await makeUser({ staffRole: "STAFF_ADMIN" });
    await makeUser({ staffRole: "STAFF_ADMIN" });
    await notifyEventRegistrationToggled("inconnu", true, actor.id);
    await notifyOrgCreated("inconnue", actor.id);
    await notifySubscriptionChanged("inconnue", actor.id);
    const org = await makeOrg();
    await notifySubscriptionChanged(org.id, actor.id);
    await notifyQuotaExceeded("inconnue", "inconnu", actor.id);
    expect(await prisma.notification.count()).toBe(0);
  });
});
