import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { __mailTesting, type ResolvedTransport } from "@/lib/mail";
import { enqueueEmail } from "@/lib/jobs/enqueue-email";
import {
  notifyEventMembershipAdded,
  notifyMembershipRoleChanged,
  notifyOrgMembershipAdded,
} from "../triggers";
import { addEventMember, addOrgMember, makeEvent, makeOrg, makeUser, sessionOf } from "./helpers";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

vi.mock("@/lib/mail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mail")>();
  return { ...actual, sendUserInvitation: vi.fn().mockResolvedValue(undefined) };
});
import { sendUserInvitation } from "@/lib/mail";

vi.mock("@/lib/jobs/enqueue-email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/jobs/enqueue-email")>()),
  enqueueEmail: vi.fn(async () => undefined),
}));

beforeEach(() => {
  vi.mocked(getServerSession).mockReset();
  vi.mocked(enqueueEmail).mockClear();
  vi.mocked(sendUserInvitation).mockClear();
  __mailTesting.setResolveTransporter(
    async () =>
      ({ transporter: {}, from: "x@y", contactEmail: "", contactPhone: "", settings: {} }) as unknown as ResolvedTransport,
  );
});
afterEach(() => __mailTesting.reset());

function login(u: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue(sessionOf(u) as never);
}

function json(body: unknown, method = "POST") {
  return new NextRequest("http://localhost/x", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const emailKinds = () => vi.mocked(enqueueEmail).mock.calls.map((c) => c[0].kind);

async function seedOrgOwner() {
  const org = await makeOrg("Acme");
  const owner = await makeUser({ name: "Owner" });
  await addOrgMember(owner.id, org.id, "OWNER");
  return { org, owner };
}

describe("déclencheurs membres et rôles", () => {
  it("ajouter un membre existant à l'org le notifie avec email", async () => {
    const { org, owner } = await seedOrgOwner();
    const target = await makeUser();
    login({ ...owner, isStaff: false });
    const { POST } = await import("@/app/api/org/[orgId]/members/route");
    const res = await POST(json({ email: target.email, name: "X", role: "MANAGER" }), {
      params: Promise.resolve({ orgId: org.id }),
    });
    expect(res.status).toBe(201);
    const row = await prisma.notification.findFirstOrThrow({ where: { userId: target.id } });
    expect(row).toMatchObject({ type: "ORG_MEMBERSHIP_ADDED", scope: "ORG", orgId: org.id, href: `/org/${org.id}` });
    expect(row.body).toContain("Gérant");
    expect(emailKinds()).toEqual(["notification.org_membership_added"]);
  });

  it("ajouter un nouvel utilisateur (invitation) le notifie sans email de notification", async () => {
    const { org, owner } = await seedOrgOwner();
    login({ ...owner, isStaff: false });
    const { POST } = await import("@/app/api/org/[orgId]/members/route");
    const res = await POST(json({ email: "nouveau@x.test", name: "Nouveau", role: "AUDITOR" }), {
      params: Promise.resolve({ orgId: org.id }),
    });
    expect(res.status).toBe(201);
    const created = await prisma.user.findUniqueOrThrow({ where: { email: "nouveau@x.test" } });
    expect(await prisma.notification.count({ where: { userId: created.id, type: "ORG_MEMBERSHIP_ADDED" } })).toBe(1);
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(sendUserInvitation).toHaveBeenCalledTimes(1);
  });

  it("ajouter un membre d'évènement le notifie en portée EVENT avec l'orgId", async () => {
    const { org, owner } = await seedOrgOwner();
    const event = await makeEvent(org.id);
    const target = await makeUser();
    login({ ...owner, isStaff: false });
    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/members/route");
    const res = await POST(json({ email: target.email, role: "OPERATOR" }), {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(201);
    const row = await prisma.notification.findFirstOrThrow({ where: { userId: target.id } });
    expect(row).toMatchObject({
      type: "EVENT_MEMBERSHIP_ADDED", scope: "EVENT", eventId: event.id, orgId: org.id, href: `/event/${event.id}`,
    });
    expect(emailKinds()).toEqual(["notification.event_membership_added"]);
  });

  it("un nouvel utilisateur invité à un évènement n'a pas d'email de notification", async () => {
    const { org, owner } = await seedOrgOwner();
    const event = await makeEvent(org.id);
    login({ ...owner, isStaff: false });
    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/members/route");
    const res = await POST(json({ email: "evt-new@x.test", role: "VIEWER" }), {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(201);
    expect(await prisma.notification.count({ where: { type: "EVENT_MEMBERSHIP_ADDED" } })).toBe(1);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("le staff qui crée une org notifie l'OWNER existant avec email", async () => {
    const staff = await makeUser({ staffRole: "STAFF_ADMIN" });
    const owner = await makeUser();
    login({ ...staff, isStaff: true });
    const { POST } = await import("@/app/api/platform/organizations/route");
    const res = await POST(json({ name: "Nouvelle Org", ownerEmail: owner.email }), { params: Promise.resolve({}) });
    expect(res.status).toBe(201);
    const row = await prisma.notification.findFirstOrThrow({ where: { userId: owner.id, type: "ORG_MEMBERSHIP_ADDED" } });
    expect(row.scope).toBe("ORG");
    expect(emailKinds()).toContain("notification.org_membership_added");
  });

  it("le staff qui crée une org notifie l'OWNER créé sans email", async () => {
    const staff = await makeUser({ staffRole: "STAFF_ADMIN" });
    login({ ...staff, isStaff: true });
    const { POST } = await import("@/app/api/platform/organizations/route");
    const res = await POST(json({ name: "Org Deux", ownerEmail: "owner-new@x.test" }), { params: Promise.resolve({}) });
    expect(res.status).toBe(201);
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: "owner-new@x.test" } });
    expect(await prisma.notification.count({ where: { userId: owner.id, type: "ORG_MEMBERSHIP_ADDED" } })).toBe(1);
    expect(emailKinds()).not.toContain("notification.org_membership_added");
  });

  it("platform/users POST notifie chaque membership sans email", async () => {
    const staff = await makeUser({ staffRole: "STAFF_ADMIN" });
    const o1 = await makeOrg("A");
    const o2 = await makeOrg("B");
    login({ ...staff, isStaff: true });
    const { POST } = await import("@/app/api/platform/users/route");
    const res = await POST(
      json({
        email: "client@x.test", name: "Client", type: "client",
        orgMemberships: [{ orgId: o1.id, role: "OWNER" }, { orgId: o2.id, role: "AUDITOR" }],
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "client@x.test" } });
    const rows = await prisma.notification.findMany({ where: { userId: user.id } });
    expect(rows.map((r) => r.orgId).sort()).toEqual([o1.id, o2.id].sort());
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("changer un rôle d'org notifie la personne avec ancien et nouveau rôle", async () => {
    const { org, owner } = await seedOrgOwner();
    const target = await makeUser();
    await addOrgMember(target.id, org.id, "AUDITOR");
    login({ ...owner, isStaff: false });
    const { PATCH } = await import("@/app/api/org/[orgId]/members/[userId]/route");
    const res = await PATCH(json({ role: "MANAGER" }, "PATCH"), {
      params: Promise.resolve({ orgId: org.id, userId: target.id }),
    });
    expect(res.status).toBe(200);
    const row = await prisma.notification.findFirstOrThrow({ where: { userId: target.id } });
    expect(row).toMatchObject({ type: "MEMBERSHIP_ROLE_CHANGED", scope: "ORG", orgId: org.id });
    expect(row.body).toContain("Auditeur");
    expect(row.body).toContain("Gérant");
    expect(emailKinds()).toEqual(["notification.membership_role_changed"]);
  });

  it("changer un rôle d'évènement notifie, mais pas vers le même rôle", async () => {
    const { org, owner } = await seedOrgOwner();
    const event = await makeEvent(org.id);
    const target = await makeUser();
    const m = await addEventMember(target.id, event.id, "VIEWER");
    login({ ...owner, isStaff: false });
    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/members/[membershipId]/route");
    const ctx = { params: Promise.resolve({ orgId: org.id, eventId: event.id, membershipId: m.id }) };
    expect((await PATCH(json({ role: "VIEWER" }, "PATCH"), ctx)).status).toBe(200);
    expect(await prisma.notification.count()).toBe(0);
    expect((await PATCH(json({ role: "OPERATOR" }, "PATCH"), ctx)).status).toBe(200);
    const row = await prisma.notification.findFirstOrThrow({ where: { userId: target.id } });
    expect(row).toMatchObject({ type: "MEMBERSHIP_ROLE_CHANGED", scope: "EVENT", eventId: event.id, orgId: org.id });
  });

  it("la branche upgraded des owners staff notifie un changement de rôle", async () => {
    const staff = await makeUser({ staffRole: "STAFF_ADMIN" });
    const { org } = await seedOrgOwner();
    const target = await makeUser();
    await addOrgMember(target.id, org.id, "AUDITOR");
    login({ ...staff, isStaff: true });
    const { POST } = await import("@/app/api/platform/organizations/[orgId]/owners/route");
    const res = await POST(json({ email: target.email, name: "T", role: "OWNER" }), {
      params: Promise.resolve({ orgId: org.id }),
    });
    expect(res.status).toBe(200);
    const row = await prisma.notification.findFirstOrThrow({ where: { userId: target.id } });
    expect(row.type).toBe("MEMBERSHIP_ROLE_CHANGED");
  });

  it("la branche création des owners staff notifie selon l'invitation", async () => {
    const staff = await makeUser({ staffRole: "STAFF_ADMIN" });
    const { org } = await seedOrgOwner();
    const existing = await makeUser();
    login({ ...staff, isStaff: true });
    const { POST } = await import("@/app/api/platform/organizations/[orgId]/owners/route");
    const ctx = { params: Promise.resolve({ orgId: org.id }) };
    expect((await POST(json({ email: existing.email, name: "E", role: "MANAGER" }), ctx)).status).toBe(201);
    expect(emailKinds()).toEqual(["notification.org_membership_added"]);
    vi.mocked(enqueueEmail).mockClear();
    expect((await POST(json({ email: "brand-new@x.test", name: "N", role: "OWNER" }), ctx)).status).toBe(201);
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(await prisma.notification.count({ where: { type: "ORG_MEMBERSHIP_ADDED" } })).toBe(2);
  });

  it("l'auteur qui s'ajoute lui-même n'est pas notifié", async () => {
    const staff = await makeUser({ staffRole: "STAFF_ADMIN" });
    const { org } = await seedOrgOwner();
    login({ ...staff, isStaff: true });
    const { POST } = await import("@/app/api/platform/organizations/[orgId]/owners/route");
    const res = await POST(json({ email: staff.email, name: "S", role: "OWNER" }), {
      params: Promise.resolve({ orgId: org.id }),
    });
    expect(res.status).toBe(201);
    expect(await prisma.notification.count({ where: { userId: staff.id } })).toBe(0);
  });

  it("organisation, évènement ou rôle identique : aucun effet", async () => {
    const actor = await makeUser();
    const u = await makeUser();
    await notifyOrgMembershipAdded({ userId: u.id, orgId: "inconnue", role: "OWNER", actorId: actor.id, invitationSent: false });
    await notifyEventMembershipAdded({ userId: u.id, eventId: "inconnu", role: "ADMIN", actorId: actor.id, invitationSent: false });
    await notifyMembershipRoleChanged({ userId: u.id, orgId: "inconnue", from: "OWNER", to: "MANAGER", actorId: actor.id });
    await notifyMembershipRoleChanged({ userId: u.id, eventId: "inconnu", from: "ADMIN", to: "VIEWER", actorId: actor.id });
    await notifyMembershipRoleChanged({ userId: u.id, orgId: "x", from: "OWNER", to: "OWNER", actorId: actor.id });
    expect(await prisma.notification.count()).toBe(0);
  });
});
