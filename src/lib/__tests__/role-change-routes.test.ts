import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { systemRoleId } from "@/lib/permissions/db";
import { loadUserContext } from "@/lib/user-context";
import { eventTargetOf, hasPermission } from "@/lib/permissions";
import { makeEvent, makeEventMember, makeOrg, makeOrgMember, makeStaff, seedFactories } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

beforeEach(() => {
  seedFactories(21);
  vi.mocked(getServerSession).mockReset();
});

function actAs(user: { id: string; email: string; name: string }, isStaff: boolean) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { ...user, isStaff } } as never);
}

function patch(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

async function ctxOf(userId: string) {
  const ctx = await loadUserContext(userId);
  if (!ctx) throw new Error("contexte absent");
  return ctx;
}

// Lignes déjà migrées (roleId posé) : le changement de rôle doit rester visible du contexte.
describe("changement de rôle sur des lignes migrées", () => {
  it("PATCH /api/platform/users/[userId] : rétrogradation puis retrait du rôle staff", async () => {
    const actor = await makeStaff("SUPER_ADMIN");
    const target = await makeStaff("STAFF_ADMIN");
    actAs(actor, true);
    expect(hasPermission(await ctxOf(target.id), "users.update", { kind: "platform" })).toBe(true);

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const url = `http://localhost/api/platform/users/${target.id}`;
    const params = { params: Promise.resolve({ userId: target.id }) };

    expect((await PATCH(patch(url, { platformRoleId: await systemRoleId(prisma, "STAFF_OBSERVER") }), params)).status).toBe(200);
    let ctx = await ctxOf(target.id);
    expect(ctx.platformRole?.systemKey).toBe("STAFF_OBSERVER");
    expect(hasPermission(ctx, "users.update", { kind: "platform" })).toBe(false);

    expect((await PATCH(patch(url, { platformRoleId: null }), params)).status).toBe(200);
    ctx = await ctxOf(target.id);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(row.platformRoleId).toBeNull();
    expect(ctx.isStaff).toBe(false);
    expect(ctx.platformRole).toBeNull();
  });

  it("PATCH /api/org/[orgId]/members/[userId] : MANAGER -> AUDITOR perd ses droits", async () => {
    const org = await makeOrg();
    const owner = await makeOrgMember(org.id, "OWNER");
    const member = await makeOrgMember(org.id, "MANAGER");
    actAs(owner, false);
    const orgTarget = { kind: "org", orgId: org.id } as const;
    expect(hasPermission(await ctxOf(member.id), "org.events.create", orgTarget)).toBe(true);

    const { PATCH } = await import("@/app/api/org/[orgId]/members/[userId]/route");
    const res = await PATCH(patch(`http://localhost/api/org/${org.id}/members/${member.id}`, { roleId: await systemRoleId(prisma, "AUDITOR") }), {
      params: Promise.resolve({ orgId: org.id, userId: member.id }),
    });
    expect(res.status).toBe(200);
    const ctx = await ctxOf(member.id);
    expect(ctx.orgMemberships[0].roleRef?.systemKey).toBe("AUDITOR");
    expect(hasPermission(ctx, "org.events.create", orgTarget)).toBe(false);
  });

  it("PATCH /api/org/[orgId]/events/[eventId]/members/[membershipId] : OPERATOR -> VIEWER perd ses droits", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const admin = await makeEventMember(event.id, "ADMIN");
    const operator = await makeEventMember(event.id, "OPERATOR");
    const membership = await prisma.eventMembership.findFirstOrThrow({ where: { userId: operator.id } });
    actAs(admin, false);
    const target = eventTargetOf({ eventId: event.id, orgId: org.id });
    expect(hasPermission(await ctxOf(operator.id), "scan.check-in", target)).toBe(true);

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/members/[membershipId]/route");
    const res = await PATCH(
      patch(`http://localhost/api/org/${org.id}/events/${event.id}/members/${membership.id}`, { roleId: await systemRoleId(prisma, "VIEWER") }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, membershipId: membership.id } as never) },
    );
    expect(res.status).toBe(200);
    const ctx = await ctxOf(operator.id);
    expect(ctx.eventMemberships[0].roleRef?.systemKey).toBe("VIEWER");
    expect(hasPermission(ctx, "scan.check-in", target)).toBe(false);
  });

  it("POST /api/platform/organizations/[orgId]/owners : le staff change le rôle d'un membre existant", async () => {
    const org = await makeOrg();
    const member = await makeOrgMember(org.id, "MANAGER");
    const staff = await makeStaff("SUPER_ADMIN");
    actAs(staff, true);
    const orgTarget = { kind: "org", orgId: org.id } as const;
    expect(hasPermission(await ctxOf(member.id), "org.update", orgTarget)).toBe(false);

    const { POST } = await import("@/app/api/platform/organizations/[orgId]/owners/route");
    const res = await POST(
      new NextRequest(`http://localhost/api/platform/organizations/${org.id}/owners`, {
        method: "POST",
        body: JSON.stringify({ email: member.email, name: member.name, roleId: await systemRoleId(prisma, "OWNER") }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect(res.status).toBe(200);
    const ctx = await ctxOf(member.id);
    expect(ctx.orgMemberships[0].roleRef?.systemKey).toBe("OWNER");
    expect(hasPermission(ctx, "org.update", orgTarget)).toBe(true);
  });
});
