import { describe, expect, it } from "vitest";
import {
  makeEvent, makeEventMember, makeOrg, makeOrgMember, makeStaff, makeUser, seedFactories,
} from "@/test/factories";
import { prisma } from "@/lib/prisma";
import { systemRoleId } from "@/lib/permissions/db";
import { effectivePermissions } from "@/lib/permissions";
import { loadUserContext } from "@/lib/user-context";
import { eventNavFor, firstAllowedEventHref } from "../event-nav";

seedFactories(2202);

async function permsOf(userId: string, orgId: string, eventId: string) {
  const ctx = (await loadUserContext(userId))!;
  return effectivePermissions(ctx, { kind: "event", eventId, orgId });
}
const labelsOf = (eventId: string, perms: ReadonlySet<never> | Set<never>, extras?: { printUnread?: number }) =>
  eventNavFor(eventId, perms as never, extras).map((e) => ("group" in e ? `[${e.group}]` : e.label));

async function scene() {
  const org = await makeOrg();
  const event = await makeEvent(org.id);
  return { org, event };
}

describe("eventNavFor", () => {
  it("PRINTER : Notifications, Badges et Documentation, pas d'Administration", async () => {
    const { org, event } = await scene();
    const user = await makeEventMember(event.id, "PRINTER");
    const perms = await permsOf(user.id, org.id, event.id);
    expect(labelsOf(event.id, perms as never)).toEqual(["Notifications", "Badges", "Documentation"]);
    expect(firstAllowedEventHref(event.id, perms)).toBe(`/event/${event.id}/badges`);
  });

  it("VIEWER : tableau de bord, notifications, vue d'ensemble", async () => {
    const { org, event } = await scene();
    const user = await makeEventMember(event.id, "VIEWER");
    const perms = await permsOf(user.id, org.id, event.id);
    expect(labelsOf(event.id, perms as never)).toEqual([
      "Tableau de bord", "Notifications", "Vue d'ensemble", "Documentation",
    ]);
  });

  it("OPERATOR : sans Vue d'ensemble ni Paramètres, avec Journal", async () => {
    const { org, event } = await scene();
    const user = await makeEventMember(event.id, "OPERATOR");
    const perms = await permsOf(user.id, org.id, event.id);
    expect(labelsOf(event.id, perms as never)).toEqual([
      "Tableau de bord", "Notifications", "Inscriptions", "Badges", "Catégories", "Scanner", "Documentation",
      "[Administration]", "Journal",
    ]);
  });

  it("ADMIN : tout sauf Vue d'ensemble, compteur sur Impression", async () => {
    const { org, event } = await scene();
    const user = await makeEventMember(event.id, "ADMIN");
    const perms = await permsOf(user.id, org.id, event.id);
    expect(labelsOf(event.id, perms as never)).toEqual([
      "Tableau de bord", "Notifications", "Inscriptions", "Badges", "Impression", "Poste sur place", "Catégories",
      "Scanner", "Membres", "Documentation", "[Administration]", "Paramètres", "Journal",
    ]);
    const print = eventNavFor(event.id, perms, { printUnread: 3 }).find((e) => "label" in e && e.label === "Impression");
    expect(print).toMatchObject({ href: `/event/${event.id}/print`, count: 3 });
  });

  it("AGENT d'organisation : poste sur place et scanner, sans prix ni inscriptions", async () => {
    const { org, event } = await scene();
    const user = await makeOrgMember(org.id, "AGENT");
    const perms = await permsOf(user.id, org.id, event.id);
    expect(labelsOf(event.id, perms as never)).toEqual([
      "Tableau de bord", "Notifications", "Badges", "Poste sur place", "Scanner", "Documentation",
      "[Administration]", "Journal",
    ]);
    expect(firstAllowedEventHref(event.id, perms)).toBe(`/event/${event.id}`);
  });

  it("AUDITOR membre PRINTER d'un évènement : union des entrées VIEWER et PRINTER", async () => {
    const { org, event } = await scene();
    const user = await makeOrgMember(org.id, "AUDITOR");
    await prisma.eventMembership.create({
      data: { userId: user.id, eventId: event.id, roleId: await systemRoleId(prisma, "PRINTER"), role: "PRINTER" },
    });
    const labels = labelsOf(event.id, (await permsOf(user.id, org.id, event.id)) as never);
    expect(labels).toEqual(expect.arrayContaining(["Tableau de bord", "Vue d'ensemble", "Badges"]));
    expect(labels).not.toContain("Inscriptions");
  });

  it("Observateur plateforme : lecture, sans Paramètres ni Scanner", async () => {
    const { org, event } = await scene();
    const staff = await makeStaff("STAFF_OBSERVER");
    const labels = labelsOf(event.id, (await permsOf(staff.id, org.id, event.id)) as never);
    expect(labels).toContain("Inscriptions");
    expect(labels).not.toContain("Paramètres");
    expect(labels).not.toContain("Scanner");
  });

  it("aucune permission : menu vide et pas d'atterrissage", async () => {
    const { org, event } = await scene();
    const user = await makeUser();
    const perms = await permsOf(user.id, org.id, event.id);
    expect(eventNavFor(event.id, perms)).toEqual([]);
    expect(firstAllowedEventHref(event.id, new Set())).toBeNull();
  });

  it("permission hors menu (rôle personnalisé) : atterrit sur Notifications, jamais sur /select", () => {
    const eventId = "evt-hors-menu";
    for (const key of ["event.categories.manage", "registration.create", "event.update", "event.registration_toggle"] as const) {
      expect(firstAllowedEventHref(eventId, new Set([key]))).toBe(`/event/${eventId}/notifications`);
    }
  });
});
