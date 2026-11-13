import { describe, expect, it } from "vitest";
import { PERMISSION_CATALOG, RESERVED_PERMISSIONS, isPermission, permissionScopeOf, type Permission } from "../catalog";
import {
  ROLE_SCOPE_ALLOWS,
  SYSTEM_ROLES,
  isSystemRoleKey,
  systemRolePermissions,
  type SystemRoleKey,
} from "../system-roles";

const KEYS = Object.keys(SYSTEM_ROLES) as SystemRoleKey[];
const perms = (k: SystemRoleKey) => new Set<string>(SYSTEM_ROLES[k].permissions);
const sorted = (k: SystemRoleKey) => [...perms(k)].sort();
const exact = (list: string[]) => [...list].sort();

describe("invariants des rôles système", () => {
  it("définit les 14 rôles avec un nom et une description", () => {
    expect(KEYS).toHaveLength(14);
    for (const k of KEYS) {
      expect(SYSTEM_ROLES[k].key).toBe(k);
      expect(SYSTEM_ROLES[k].name.length).toBeGreaterThan(0);
      expect(SYSTEM_ROLES[k].description.length).toBeGreaterThan(0);
    }
  });

  it.each(KEYS)("%s : permissions du catalogue, de niveau autorisé, sans doublon", (k) => {
    const role = SYSTEM_ROLES[k];
    expect(new Set(role.permissions).size).toBe(role.permissions.length);
    for (const p of role.permissions) {
      expect(isPermission(p)).toBe(true);
      expect(ROLE_SCOPE_ALLOWS[role.scope]).toContain(permissionScopeOf(p));
    }
  });

  it("table « qui peut porter quoi »", () => {
    expect(ROLE_SCOPE_ALLOWS).toEqual({
      PLATFORM: ["PLATFORM", "ORG", "EVENT"],
      ORG: ["ORG", "EVENT"],
      EVENT: ["EVENT"],
      PARTICIPANT: ["PARTICIPANT"],
    });
  });

  it("les clés reserved n'apparaissent que chez SUPER_ADMIN et OWNER", () => {
    expect(RESERVED_PERMISSIONS).toHaveLength(4);
    const holders = (p: string) => KEYS.filter((k) => perms(k).has(p)).sort();
    expect(holders("platform.roles.manage")).toEqual(["SUPER_ADMIN"]);
    expect(holders("users.permissions.manage")).toEqual(["SUPER_ADMIN"]);
    expect(holders("org.roles.manage")).toEqual(["OWNER", "SUPER_ADMIN"]);
    expect(holders("org.members.permissions.manage")).toEqual(["OWNER", "SUPER_ADMIN"]);
  });

  it("SUPER_ADMIN = tout le catalogue sauf le niveau PARTICIPANT", () => {
    const expected = PERMISSION_CATALOG.filter((p) => p.scope !== "PARTICIPANT").map((p) => p.key);
    expect(sorted("SUPER_ADMIN")).toEqual(exact(expected));
  });
});

describe("valeurs exactes", () => {
  it("STAFF_PRINTER", () => {
    expect(sorted("STAFF_PRINTER")).toEqual(
      exact([
        "platform.access",
        "print.requests.read",
        "print.requests.messages.send",
        "print.requests.reject",
        "print.requests.advance",
        "print.catalog.read",
        "print.layouts.read",
        "print.sheets.read",
        "print.sheets.generate",
        "badge.print",
        "print.onsite.operate",
      ]),
    );
    expect(SYSTEM_ROLES.STAFF_PRINTER.permissions.filter((p) => permissionScopeOf(p) === "ORG")).toEqual([]);
  });

  it("AGENT", () => {
    expect(sorted("AGENT")).toEqual(
      exact(["org.read", "org.events.list", "scan.history.read", "badge.print", "scan.check-in", "print.onsite.operate"]),
    );
  });

  it("rôles évènement et participant", () => {
    expect(sorted("VIEWER")).toEqual(["event.read.aggregated"]);
    expect(sorted("PRINTER")).toEqual(["badge.print"]);
    expect(sorted("OPERATOR")).toEqual(
      exact([
        "event.read.aggregated",
        "event.read.detailed",
        "scan.history.read",
        "registration.approve",
        "badge.print",
        "scan.check-in",
      ]),
    );
    expect(sorted("PARTICIPANT")).toEqual(
      exact(["account.profile.update", "account.profile.upload", "registration.self.create", "registration.self.resubmit"]),
    );
  });

  it("ADMIN d'évènement : tout le niveau EVENT", () => {
    const event = PERMISSION_CATALOG.filter((p) => p.scope === "EVENT").map((p) => p.key);
    expect(sorted("ADMIN")).toEqual(exact(event));
  });

  it("STAFF_OBSERVER est en lecture seule", () => {
    const writing = /\.(manage|update|create|delete|archive|send|review|approve|block|export|advance|reject|generate|reopen|apply|mark_paid|complete|operate|check-in|print)$/;
    const offenders = SYSTEM_ROLES.STAFF_OBSERVER.permissions.filter((p) => writing.test(p) && p !== "print.request");
    expect(offenders).toEqual([]);
    expect(perms("STAFF_OBSERVER").has("print.request")).toBe(true);
  });

  it("STAFF_SUPPORT", () => {
    const s = perms("STAFF_SUPPORT");
    expect(s.has("print.requests.advance")).toBe(false);
    expect(s.has("print.requests.messages.send")).toBe(false);
    for (const p of ["profiles.review", "registration.approve", "users.create", "users.password.reset"]) {
      expect(s.has(p)).toBe(true);
    }
    expect([...s].filter((p) => p.startsWith("print.sheets") || p === "badge.print")).toEqual([]);
  });

  it("STAFF_ADMIN = SUPER_ADMIN moins les clés réservées au sommet et à l'OWNER", () => {
    const missing = [
      "organizations.delete",
      "users.staff.assign_top_role",
      "settings.secrets.update",
      "platform.roles.manage",
      "users.permissions.manage",
      "org.roles.manage",
      "org.members.permissions.manage",
      "billing.subscription.pay",
      "print.quote.accept",
    ];
    const expected = [...perms("SUPER_ADMIN")].filter((p) => !missing.includes(p));
    expect(sorted("STAFF_ADMIN")).toEqual(exact(expected));
  });

  it("MANAGER n'a pas les droits propriétaires", () => {
    const m = perms("MANAGER");
    for (const p of ["org.update", "org.members.manage", "billing.subscription.pay", "print.quote.accept"]) {
      expect(m.has(p)).toBe(false);
    }
  });

  it("OWNER = tout le niveau ORG et EVENT", () => {
    const expected = PERMISSION_CATALOG.filter((p) => p.scope === "ORG" || p.scope === "EVENT").map((p) => p.key);
    expect(sorted("OWNER")).toEqual(exact(expected));
  });

  it("AUDITOR consulte sans écrire", () => {
    expect(sorted("AUDITOR")).toEqual(
      exact([
        "org.read",
        "org.activity.read",
        "org.members.read",
        "org.templates.read",
        "org.events.list",
        "event.read.aggregated",
      ]),
    );
  });
});

describe("helpers", () => {
  it("isSystemRoleKey", () => {
    expect(isSystemRoleKey("OWNER")).toBe(true);
    expect(isSystemRoleKey("toString")).toBe(false);
    expect(isSystemRoleKey("CUSTOM")).toBe(false);
    expect(isSystemRoleKey(3)).toBe(false);
  });

  it("systemRolePermissions renvoie un ensemble mémoïsé", () => {
    const a = systemRolePermissions("OPERATOR");
    expect(a).toBe(systemRolePermissions("OPERATOR"));
    expect(a.has("scan.check-in" as Permission)).toBe(true);
    expect(a.size).toBe(SYSTEM_ROLES.OPERATOR.permissions.length);
  });
});
