import { describe, expect, it } from "vitest";
import {
  PERMISSION_CATALOG,
  PERMISSION_KEYS,
  RESERVED_PERMISSIONS,
  isPermission,
  permissionDef,
  permissionScopeOf,
} from "../catalog";

const PLATFORM = [
  "platform.access",
  "platform.roles.manage",
  "users.permissions.manage",
  "organizations.read",
  "organizations.create",
  "organizations.update",
  "organizations.archive",
  "organizations.delete",
  "organizations.members.manage",
  "subscriptions.update",
  "plans.read",
  "plans.manage",
  "payments.read",
  "users.read",
  "users.update",
  "users.create",
  "users.staff.create",
  "users.staff.assign_role",
  "users.staff.assign_top_role",
  "users.archive",
  "users.password.reset",
  "profiles.read",
  "profiles.review",
  "blocklist.read",
  "blocklist.manage",
  "settings.read",
  "settings.update",
  "settings.secrets.update",
  "settings.smtp.test",
  "settings.subscription_rights.update",
  "settings.badge_template.update",
  "settings.onsite_print.update",
  "rejection_reasons.read",
  "rejection_reasons.manage",
  "badge_templates.read",
  "badge_templates.manage",
  "email_jobs.read",
  "email_jobs.manage",
  "activity.read",
  "print.requests.read",
  "print.requests.messages.send",
  "print.requests.reject",
  "print.requests.advance",
  "print.requests.onsite.complete",
  "print.requests.quote.edit",
  "print.requests.quote.send",
  "print.requests.reopen",
  "print.requests.mark_paid",
  "print.requests.credit.apply",
  "print.onsite.margin.update",
  "print.catalog.read",
  "print.catalog.manage",
  "print.layouts.read",
  "print.layouts.manage",
  "print.sheets.read",
  "print.sheets.generate",
];

const ORG = [
  "org.read",
  "org.update",
  "org.activity.read",
  "org.members.read",
  "org.members.manage",
  "org.roles.manage",
  "org.members.permissions.manage",
  "org.templates.read",
  "org.templates.manage",
  "org.badge_settings.update",
  "org.upload",
  "org.events.list",
  "org.events.create",
  "org.events.archive",
  "billing.subscription.read",
  "billing.subscription.pay",
  "billing.payments.read",
  "print.quote.accept",
];

const EVENT = [
  "event.read.aggregated",
  "event.read.detailed",
  "event.update",
  "event.registration_toggle",
  "event.settings.update",
  "event.categories.manage",
  "event.members.manage",
  "event.activity.read",
  "scan.history.read",
  "registration.approve",
  "registration.create",
  "registration.update",
  "registration.delete",
  "registration.export",
  "registration.block",
  "registration.all_access",
  "badge.print",
  "scan.check-in",
  "print.request",
  "print.onsite.operate",
];

const PARTICIPANT = [
  "account.profile.update",
  "account.profile.upload",
  "registration.self.create",
  "registration.self.resubmit",
];

const BY_LEVEL = { PLATFORM, ORG, EVENT, PARTICIPANT } as const;

describe("PERMISSION_CATALOG", () => {
  for (const [scope, keys] of Object.entries(BY_LEVEL)) {
    it(`contient exactement les clés du niveau ${scope}`, () => {
      const actual = PERMISSION_CATALOG.filter((p) => p.scope === scope).map((p) => p.key);
      expect([...actual].sort()).toEqual([...keys].sort());
    });
  }

  it("compte 56 + 18 + 20 + 4 clés", () => {
    expect([PLATFORM.length, ORG.length, EVENT.length, PARTICIPANT.length]).toEqual([56, 18, 20, 4]);
    expect(PERMISSION_CATALOG).toHaveLength(98);
  });

  it("a des clés uniques", () => {
    expect(PERMISSION_KEYS.size).toBe(PERMISSION_CATALOG.length);
  });

  it("a des libellés et descriptions non vides en français", () => {
    for (const p of PERMISSION_CATALOG) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.label).toMatch(/[ àâçéèêëîïôûùü]/i);
      expect(p.description).toMatch(/[ àâçéèêëîïôûùü]/i);
    }
  });

  it("marque reserved uniquement les quatre permissions de gestion des droits", () => {
    const expected = [
      "platform.roles.manage",
      "users.permissions.manage",
      "org.roles.manage",
      "org.members.permissions.manage",
    ];
    expect([...RESERVED_PERMISSIONS].sort()).toEqual([...expected].sort());
    const flagged = PERMISSION_CATALOG.filter((p) => "reserved" in p).map((p) => p.key);
    expect([...flagged].sort()).toEqual([...expected].sort());
  });

  it("reconnaît les clés valides et rejette les autres", () => {
    expect(isPermission("event.archive")).toBe(false);
    expect(isPermission("org.events.archive")).toBe(true);
    expect(isPermission(42)).toBe(false);
  });

  it("expose la définition et le niveau d'une permission", () => {
    expect(permissionDef("scan.check-in").key).toBe("scan.check-in");
    expect(permissionScopeOf("scan.check-in")).toBe("EVENT");
    expect(permissionScopeOf("account.profile.update")).toBe("PARTICIPANT");
  });
});
