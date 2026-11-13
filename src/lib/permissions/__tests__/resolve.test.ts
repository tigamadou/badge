import { describe, expect, it } from "vitest";
import { buildUserContext } from "@/lib/user-context";
import type { UserContext } from "@/types/auth";
import type { Permission } from "../catalog";
import { effectivePermissions, eventTargetOf, hasPermission, isStaffActor, memberPermissions, type PermissionTarget } from "../resolve";

type Row = Parameters<typeof buildUserContext>[0];
type Opts = {
  isStaff?: boolean;
  staffRole?: Row["staffRole"];
  orgs?: { orgId: string; role: "OWNER" | "MANAGER" | "AUDITOR" | "AGENT" }[];
  events?: { eventId: string; role: "ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER" }[];
  overrides?: { orgId: string | null; permission: string; effect: "GRANT" | "REVOKE" }[];
  customOrgRole?: { orgId: string; permissions: string[] };
};

function ctx(o: Opts = {}): UserContext {
  const row = {
    id: "u1",
    email: "u@example.test",
    name: "U",
    isStaff: o.isStaff ?? false,
    archived: false,
    staffRole: o.staffRole ?? null,
    platformRole: null,
    orgMemberships: [
      ...(o.orgs ?? []).map((m) => ({ orgId: m.orgId, role: m.role, roleId: null, roleRef: null })),
      ...(o.customOrgRole
        ? [
            {
              orgId: o.customOrgRole.orgId,
              role: null,
              roleId: "r-custom",
              roleRef: {
                id: "r-custom",
                systemKey: null,
                scope: "ORG" as const,
                name: "Perso",
                archived: false,
                permissions: o.customOrgRole.permissions.map((permission) => ({ permission })),
              },
            },
          ]
        : []),
    ],
    eventMemberships: (o.events ?? []).map((m) => ({ eventId: m.eventId, role: m.role, roleId: null, roleRef: null })),
    permissionOverrides: o.overrides ?? [],
  } as unknown as Row;
  return buildUserContext(row);
}

const ORG = "org1";
const EV = "ev1";
const org: PermissionTarget = { kind: "org", orgId: ORG };
const ev: PermissionTarget = { kind: "event", eventId: EV, orgId: ORG };
const sorted = (s: Set<Permission>) => [...s].sort();
const keys = (l: string[]) => [...l].sort();

describe("base des permissions", () => {
  it("SUPER_ADMIN a badge.print sur un évènement", () => {
    expect(hasPermission(ctx({ isStaff: true, staffRole: "SUPER_ADMIN" }), "badge.print", ev)).toBe(true);
  });

  it("STAFF_OBSERVER lit l'agrégé mais ne supprime pas d'inscription", () => {
    const c = ctx({ isStaff: true, staffRole: "STAFF_OBSERVER" });
    expect(hasPermission(c, "event.read.aggregated", ev)).toBe(true);
    expect(hasPermission(c, "registration.delete", ev)).toBe(false);
  });

  it("membre d'org AGENT : org.read et org.events.list sur son org", () => {
    expect(sorted(effectivePermissions(ctx({ orgs: [{ orgId: ORG, role: "AGENT" }] }), org))).toEqual(keys(["org.read", "org.events.list"]));
  });

  it("membre d'org AGENT : rien sur une autre org", () => {
    expect(effectivePermissions(ctx({ orgs: [{ orgId: ORG, role: "AGENT" }] }), { kind: "org", orgId: "autre" }).size).toBe(0);
  });

  it("membre d'org AGENT : ses clés EVENT sur un évènement de l'org", () => {
    expect(sorted(effectivePermissions(ctx({ orgs: [{ orgId: ORG, role: "AGENT" }] }), ev))).toEqual(
      keys(["scan.history.read", "badge.print", "scan.check-in", "print.onsite.operate"]),
    );
  });

  it("union rôle d'org AUDITOR + rôle d'évènement PRINTER", () => {
    const c = ctx({ orgs: [{ orgId: ORG, role: "AUDITOR" }], events: [{ eventId: EV, role: "PRINTER" }] });
    expect(sorted(effectivePermissions(c, ev))).toEqual(keys(["event.read.aggregated", "badge.print"]));
  });

  it("rôle d'org personnalisé : ses permissions valent pour tous les évènements de l'org", () => {
    const c = ctx({ customOrgRole: { orgId: ORG, permissions: ["badge.print", "org.read"] } });
    expect(sorted(effectivePermissions(c, ev))).toEqual(["badge.print"]);
    expect(sorted(effectivePermissions(c, org))).toEqual(["org.read"]);
  });

  it("cible participant : tout compte détient les 4 clés PARTICIPANT", () => {
    const p = effectivePermissions(ctx(), { kind: "participant" });
    expect(p.size).toBe(4);
    expect(p.has("registration.self.create")).toBe(true);
  });

  it("cible plateforme sans rôle : vide", () => {
    expect(effectivePermissions(ctx(), { kind: "platform" }).size).toBe(0);
  });
});

describe("ajustements", () => {
  const agent = { orgs: [{ orgId: ORG, role: "AGENT" as const }] };

  it("REVOKE plateforme (orgId nul) retire une clé PARTICIPANT", () => {
    const c = ctx({ overrides: [{ orgId: null, permission: "registration.self.create", effect: "REVOKE" }] });
    expect(hasPermission(c, "registration.self.create", { kind: "participant" })).toBe(false);
  });

  it("GRANT ajoute", () => {
    const c = ctx({ ...agent, overrides: [{ orgId: ORG, permission: "registration.delete", effect: "GRANT" }] });
    expect(hasPermission(c, "registration.delete", ev)).toBe(true);
  });

  it("REVOKE retire", () => {
    const c = ctx({ ...agent, overrides: [{ orgId: ORG, permission: "badge.print", effect: "REVOKE" }] });
    expect(hasPermission(c, "badge.print", ev)).toBe(false);
  });

  it("REVOKE d'une autre organisation sans effet", () => {
    const c = ctx({ ...agent, overrides: [{ orgId: "autre", permission: "badge.print", effect: "REVOKE" }] });
    expect(hasPermission(c, "badge.print", ev)).toBe(true);
  });

  it("ajustement plateforme sur une clé ORG s'applique à toute org", () => {
    const c = ctx({ overrides: [{ orgId: null, permission: "org.read", effect: "GRANT" }] });
    expect(hasPermission(c, "org.read", org)).toBe(true);
    expect(hasPermission(c, "org.read", { kind: "org", orgId: "autre" })).toBe(true);
  });

  it("ajustement de clé de mauvais niveau ignoré", () => {
    const c = ctx({ overrides: [{ orgId: null, permission: "badge.print", effect: "GRANT" }] });
    expect(hasPermission(c, "badge.print", org)).toBe(false);
    expect(hasPermission(c, "badge.print", ev)).toBe(true);
  });

  it("ajustement d'organisation appliqué après l'ajustement plateforme", () => {
    const c = ctx({
      overrides: [
        { orgId: null, permission: "badge.print", effect: "REVOKE" },
        { orgId: ORG, permission: "badge.print", effect: "GRANT" },
      ],
    });
    expect(hasPermission(c, "badge.print", ev)).toBe(true);
  });
});

describe("hasPermission, isStaffActor, eventTargetOf", () => {
  it("hasPermission = appartenance à l'ensemble effectif", () => {
    const c = ctx({ orgs: [{ orgId: ORG, role: "AGENT" }] });
    expect(hasPermission(c, "org.read", org)).toBe(true);
    expect(hasPermission(c, "org.update", org)).toBe(false);
  });

  it("staff sans membership : acteur staff", () => {
    const c = ctx({ isStaff: true, staffRole: "STAFF_ADMIN" });
    expect(isStaffActor(c, org)).toBe(true);
    expect(isStaffActor(c, ev)).toBe(true);
  });

  it("staff membre de l'org : pas acteur staff (org et évènement)", () => {
    const c = ctx({ isStaff: true, staffRole: "STAFF_ADMIN", orgs: [{ orgId: ORG, role: "AUDITOR" }] });
    expect(isStaffActor(c, org)).toBe(false);
    expect(isStaffActor(c, ev)).toBe(false);
  });

  it("staff membre de l'évènement seul : pas acteur staff pour l'évènement", () => {
    const c = ctx({ isStaff: true, staffRole: "STAFF_ADMIN", events: [{ eventId: EV, role: "VIEWER" }] });
    expect(isStaffActor(c, ev)).toBe(false);
    expect(isStaffActor(c, org)).toBe(true);
  });

  it("non staff : faux", () => {
    expect(isStaffActor(ctx(), ev)).toBe(false);
  });

  it("cibles platform et participant : faux", () => {
    const c = ctx({ isStaff: true, staffRole: "STAFF_ADMIN" });
    expect(isStaffActor(c, { kind: "platform" })).toBe(false);
    expect(isStaffActor(c, { kind: "participant" })).toBe(false);
  });

  it("eventTargetOf accepte { id, orgId } et { eventId, orgId }", () => {
    expect(eventTargetOf({ id: "e", orgId: "o" })).toEqual({ kind: "event", eventId: "e", orgId: "o" });
    expect(eventTargetOf({ eventId: "e", orgId: "o" })).toEqual({ kind: "event", eventId: "e", orgId: "o" });
  });
});

describe("invariant isStaff et memberPermissions", () => {
  it("le rôle plateforme est ignoré quand isStaff est faux (repli staffRole d'une ligne incohérente)", () => {
    const c = ctx({ isStaff: false, staffRole: "SUPER_ADMIN" });
    expect(c.platformRole).not.toBeNull();
    expect(effectivePermissions(c, org).size).toBe(0);
    expect(effectivePermissions(c, ev).size).toBe(0);
    expect(hasPermission(c, "users.update", { kind: "platform" })).toBe(false);
  });

  it("memberPermissions d'un staff membre écarte le rôle plateforme et ses ajustements", () => {
    const c = ctx({
      isStaff: true,
      staffRole: "SUPER_ADMIN",
      orgs: [{ orgId: ORG, role: "AGENT" }],
      overrides: [
        { orgId: null, permission: "org.update", effect: "GRANT" },
        { orgId: ORG, permission: "org.events.create", effect: "GRANT" },
      ],
    });
    expect(hasPermission(c, "print.quote.accept", org)).toBe(true);
    const member = memberPermissions(c, org);
    expect(member.has("print.quote.accept")).toBe(false);
    expect(member.has("org.update")).toBe(false);
    expect(member.has("org.read")).toBe(true);
    expect(member.has("org.events.create")).toBe(true);
    expect(memberPermissions(c, ev).has("print.request")).toBe(false);
    expect(memberPermissions(c, { kind: "platform" }).size).toBe(0);
  });

  it("memberPermissions d'un staff membre applique ses REVOKE plateforme mais pas ses GRANT plateforme", () => {
    const c = ctx({
      isStaff: true,
      staffRole: "SUPER_ADMIN",
      orgs: [{ orgId: ORG, role: "OWNER" }],
      overrides: [{ orgId: null, permission: "print.quote.accept", effect: "REVOKE" }],
    });
    expect(memberPermissions(c, org).has("print.quote.accept")).toBe(false);
    expect(memberPermissions(c, org).has("org.read")).toBe(true);
  });

  it("memberPermissions égale effectivePermissions pour un non-staff", () => {
    const c = ctx({
      orgs: [{ orgId: ORG, role: "MANAGER" }],
      events: [{ eventId: EV, role: "VIEWER" }],
      overrides: [{ orgId: null, permission: "org.update", effect: "GRANT" }],
    });
    for (const t of [org, ev, { kind: "platform" } as PermissionTarget, { kind: "participant" } as PermissionTarget]) {
      expect(sorted(new Set(memberPermissions(c, t)))).toEqual(sorted(effectivePermissions(c, t)));
    }
  });
});
