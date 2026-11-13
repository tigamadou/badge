import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeEvent, makeEventMember, makeOrg, makeOrgMember, makeStaff, makeUser, seedFactories } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
import { getServerSession } from "next-auth";
import { requireEventPagePermission } from "../page-access";

seedFactories(2204);

function as(user: { id: string; email: string; name: string } | null) {
  vi.mocked(getServerSession).mockResolvedValue((user ? { user: { ...user, isStaff: false } } : null) as never);
}

async function scene() {
  const org = await makeOrg();
  return { org, event: await makeEvent(org.id) };
}

describe("requireEventPagePermission", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("sans session : connexion avec callbackUrl", async () => {
    as(null);
    await expect(requireEventPagePermission("e1", null, "/event/e1/badges")).rejects.toThrow(
      "REDIRECT:/login?callbackUrl=%2Fevent%2Fe1%2Fbadges",
    );
  });

  it("session sans compte en base : connexion", async () => {
    as({ id: "inconnu", email: "x@x.test", name: "X" });
    await expect(requireEventPagePermission("e1", null, "/x")).rejects.toThrow("REDIRECT:/login");
  });

  it("évènement inconnu : notFound", async () => {
    as(await makeUser());
    await expect(requireEventPagePermission("inconnu", null, "/x")).rejects.toThrow("NOT_FOUND");
  });

  it("aucune permission sur l'évènement : /select", async () => {
    const { event } = await scene();
    as(await makeUser());
    await expect(requireEventPagePermission(event.id, null, "/x")).rejects.toThrow("REDIRECT:/select");
    await expect(requireEventPagePermission(event.id, "badge.print", "/x")).rejects.toThrow("REDIRECT:/select");
  });

  it("permission manquante : /event/[eventId]", async () => {
    const { event } = await scene();
    as(await makeEventMember(event.id, "PRINTER"));
    await expect(requireEventPagePermission(event.id, "event.read.detailed", "/x")).rejects.toThrow(
      `REDIRECT:/event/${event.id}`,
    );
  });

  it("null : au moins une permission suffit", async () => {
    const { event, org } = await scene();
    as(await makeEventMember(event.id, "PRINTER"));
    const res = await requireEventPagePermission(event.id, null, "/x");
    expect(res.orgId).toBe(org.id);
    expect(res.event).toMatchObject({ id: event.id, title: event.title, archived: false });
  });

  it("liste : la seconde permission suffit", async () => {
    const { event } = await scene();
    as(await makeEventMember(event.id, "OPERATOR"));
    const res = await requireEventPagePermission(event.id, ["event.activity.read", "scan.history.read"], "/x");
    expect(res.permissions.has("scan.history.read")).toBe(true);
    expect(res.permissions.has("event.activity.read")).toBe(false);
  });

  it("permission unique détenue via le rôle d'organisation", async () => {
    const { event, org } = await scene();
    as(await makeOrgMember(org.id, "AGENT"));
    const res = await requireEventPagePermission(event.id, "print.onsite.operate", "/x");
    expect(res.isStaffActor).toBe(false);
  });

  it("isStaffActor : vrai pour un staff sans appartenance, faux pour un staff membre de l'organisation", async () => {
    const { event, org } = await scene();
    const staff = await makeStaff("STAFF_SUPPORT");
    as(staff);
    expect((await requireEventPagePermission(event.id, "event.read.detailed", "/x")).isStaffActor).toBe(true);

    const memberStaff = await makeStaff("STAFF_SUPPORT");
    const { prisma } = await import("@/lib/prisma");
    const { systemRoleId } = await import("@/lib/permissions/db");
    await prisma.orgMembership.create({
      data: { userId: memberStaff.id, orgId: org.id, roleId: await systemRoleId(prisma, "AUDITOR"), role: "AUDITOR" },
    });
    as(memberStaff);
    expect((await requireEventPagePermission(event.id, "event.read.detailed", "/x")).isStaffActor).toBe(false);
  });
});
