import { describe, it, expect } from "vitest";
import {
  staffRoleAtLeast,
  orgRoleAtLeast,
  hasOrgRole,
  effectiveEventRole,
  hasEventPermission,
} from "@/lib/auth-helpers";
import type { UserContext } from "@/types/auth";
import type { OrgRole } from "@prisma/client";

const baseCtx = (over: Partial<UserContext> = {}): UserContext => ({
  user: { id: "u1", email: "u@x", name: "U" },
  isStaff: false,
  staffRole: null,
  orgMemberships: [],
  eventMemberships: [],
  ...over,
});

describe("staffRoleAtLeast", () => {
  it("SUPER_ADMIN >= STAFF_ADMIN", () => {
    expect(staffRoleAtLeast("SUPER_ADMIN", "STAFF_ADMIN")).toBe(true);
  });
  it("SUPER_ADMIN >= SUPER_ADMIN", () => {
    expect(staffRoleAtLeast("SUPER_ADMIN", "SUPER_ADMIN")).toBe(true);
  });
  it("STAFF_ADMIN < SUPER_ADMIN", () => {
    expect(staffRoleAtLeast("STAFF_ADMIN", "SUPER_ADMIN")).toBe(false);
  });
  it("STAFF_ADMIN >= STAFF_SUPPORT", () => {
    expect(staffRoleAtLeast("STAFF_ADMIN", "STAFF_SUPPORT")).toBe(true);
  });
  it("STAFF_SUPPORT >= STAFF_SUPPORT", () => {
    expect(staffRoleAtLeast("STAFF_SUPPORT", "STAFF_SUPPORT")).toBe(true);
  });
  it("STAFF_OBSERVER < STAFF_SUPPORT", () => {
    expect(staffRoleAtLeast("STAFF_OBSERVER", "STAFF_SUPPORT")).toBe(false);
  });
});

describe("orgRoleAtLeast", () => {
  it("OWNER >= MANAGER", () => {
    expect(orgRoleAtLeast("OWNER", "MANAGER")).toBe(true);
  });
  it("MANAGER >= AUDITOR", () => {
    expect(orgRoleAtLeast("MANAGER", "AUDITOR")).toBe(true);
  });
  it("AUDITOR >= AUDITOR", () => {
    expect(orgRoleAtLeast("AUDITOR", "AUDITOR")).toBe(true);
  });
  it("MANAGER < OWNER", () => {
    expect(orgRoleAtLeast("MANAGER", "OWNER")).toBe(false);
  });
  it("AUDITOR < MANAGER", () => {
    expect(orgRoleAtLeast("AUDITOR", "MANAGER")).toBe(false);
  });
});

describe("hasOrgRole", () => {
  it("returns true if membership exactly matches", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "OWNER" }] });
    expect(hasOrgRole(ctx, "o1", "OWNER")).toBe(true);
  });
  it("OWNER satisfies MANAGER requirement", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "OWNER" }] });
    expect(hasOrgRole(ctx, "o1", "MANAGER")).toBe(true);
  });
  it("OWNER and MANAGER satisfy AUDITOR requirement", () => {
    const ctxOwner = baseCtx({ orgMemberships: [{ orgId: "o1", role: "OWNER" }] });
    const ctxManager = baseCtx({ orgMemberships: [{ orgId: "o1", role: "MANAGER" }] });
    expect(hasOrgRole(ctxOwner, "o1", "AUDITOR")).toBe(true);
    expect(hasOrgRole(ctxManager, "o1", "AUDITOR")).toBe(true);
  });
  it("MANAGER does not satisfy OWNER requirement", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "MANAGER" }] });
    expect(hasOrgRole(ctx, "o1", "OWNER")).toBe(false);
  });
  it("AUDITOR does not satisfy MANAGER requirement", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "AUDITOR" }] });
    expect(hasOrgRole(ctx, "o1", "MANAGER")).toBe(false);
  });
  it("staff without allowStaff does NOT get org role by default", () => {
    const ctx = baseCtx({ isStaff: true, staffRole: "STAFF_SUPPORT" });
    expect(hasOrgRole(ctx, "any", "OWNER")).toBe(false);
  });
  it("staff gets org role only when allowStaff is true", () => {
    const ctx = baseCtx({ isStaff: true, staffRole: "STAFF_SUPPORT" });
    expect(hasOrgRole(ctx, "any", "OWNER", { allowStaff: true })).toBe(true);
  });
  it("member keeps its role regardless of the allowStaff flag", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "OWNER" }] });
    expect(hasOrgRole(ctx, "o1", "MANAGER")).toBe(true);
    expect(hasOrgRole(ctx, "o1", "MANAGER", { allowStaff: true })).toBe(true);
  });
  it("returns false if no membership and not staff", () => {
    expect(hasOrgRole(baseCtx(), "o1", "OWNER")).toBe(false);
  });
});

describe("effectiveEventRole", () => {
  it("returns STAFF for staff user", () => {
    const ctx = baseCtx({ isStaff: true, staffRole: "STAFF_ADMIN" });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("STAFF");
  });
  it("returns STAFF for SUPER_ADMIN", () => {
    const ctx = baseCtx({ isStaff: true, staffRole: "SUPER_ADMIN" });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("STAFF");
  });
  it("returns ADMIN when user is OWNER of parent org", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "OWNER" }] });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("ADMIN");
  });
  it("returns ADMIN when user is MANAGER of parent org (heritage)", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "MANAGER" }] });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("ADMIN");
  });
  it("returns VIEWER when user is AUDITOR of parent org (heritage)", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "AUDITOR" }] });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("VIEWER");
  });
  it("returns explicit EventMembership.role when present", () => {
    const ctx = baseCtx({ eventMemberships: [{ eventId: "e1", role: "OPERATOR" }] });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("OPERATOR");
  });
  it("returns PRINTER for explicit PRINTER membership", () => {
    const ctx = baseCtx({ eventMemberships: [{ eventId: "e1", role: "PRINTER" }] });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("PRINTER");
  });
  it("returns VIEWER for explicit VIEWER membership", () => {
    const ctx = baseCtx({ eventMemberships: [{ eventId: "e1", role: "VIEWER" }] });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("VIEWER");
  });
  it("STAFF wins over OWNER and explicit", () => {
    const ctx = baseCtx({
      isStaff: true,
      staffRole: "STAFF_ADMIN",
      orgMemberships: [{ orgId: "o1", role: "OWNER" }],
      eventMemberships: [{ eventId: "e1", role: "OPERATOR" }],
    });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("STAFF");
  });
  it("falls through to event membership when the org role is unrecognized", () => {
    // Branche defensive l.106 (else) : org membership present mais role hors enum
    // (ni OWNER/MANAGER ni AUDITOR) => on ne derive rien de l'org et on lit l'event.
    const ctx = baseCtx({
      orgMemberships: [{ orgId: "o1", role: "UNKNOWN" as unknown as OrgRole }],
      eventMemberships: [{ eventId: "e1", role: "PRINTER" }],
    });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("PRINTER");
  });

  it("returns null when the org role is unrecognized and no event membership", () => {
    const ctx = baseCtx({
      orgMemberships: [{ orgId: "o1", role: "UNKNOWN" as unknown as OrgRole }],
    });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBeNull();
  });

  it("returns null when no rights", () => {
    expect(effectiveEventRole(baseCtx(), "e1", "o1")).toBeNull();
  });
});

describe("hasEventPermission", () => {
  it("PRINTER can badge.print but not scan.check-in", () => {
    const ctx = baseCtx({ eventMemberships: [{ eventId: "e1", role: "PRINTER" }] });
    expect(hasEventPermission(ctx, "e1", "o1", "badge.print")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "scan.check-in")).toBe(false);
  });

  it("VIEWER can read.aggregated but not read.detailed nor badge.print", () => {
    const ctx = baseCtx({ eventMemberships: [{ eventId: "e1", role: "VIEWER" }] });
    expect(hasEventPermission(ctx, "e1", "o1", "event.read.aggregated")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "event.read.detailed")).toBe(false);
    expect(hasEventPermission(ctx, "e1", "o1", "badge.print")).toBe(false);
  });

  it("OPERATOR can read.detailed, approve, badge.print, scan.check-in", () => {
    const ctx = baseCtx({ eventMemberships: [{ eventId: "e1", role: "OPERATOR" }] });
    expect(hasEventPermission(ctx, "e1", "o1", "event.read.detailed")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "registration.approve")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "badge.print")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "scan.check-in")).toBe(true);
  });
  it("OPERATOR cannot delete registration nor update event", () => {
    const ctx = baseCtx({ eventMemberships: [{ eventId: "e1", role: "OPERATOR" }] });
    expect(hasEventPermission(ctx, "e1", "o1", "registration.delete")).toBe(false);
    expect(hasEventPermission(ctx, "e1", "o1", "event.update")).toBe(false);
  });

  it("ADMIN can do everything (sample)", () => {
    const ctx = baseCtx({ eventMemberships: [{ eventId: "e1", role: "ADMIN" }] });
    expect(hasEventPermission(ctx, "e1", "o1", "event.read.detailed")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "registration.delete")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "event.update")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "badge.print")).toBe(true);
  });

  it("OWNER of parent org has all event permissions", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "OWNER" }] });
    expect(hasEventPermission(ctx, "e1", "o1", "event.update")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "registration.delete")).toBe(true);
  });
  it("MANAGER of parent org has all event permissions (heritage symetrique a OWNER)", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "MANAGER" }] });
    expect(hasEventPermission(ctx, "e1", "o1", "event.update")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "registration.delete")).toBe(true);
  });
  it("AUDITOR of parent org : event.read.aggregated only, refuses detailed", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "AUDITOR" }] });
    expect(hasEventPermission(ctx, "e1", "o1", "event.read.aggregated")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "event.read.detailed")).toBe(false);
    expect(hasEventPermission(ctx, "e1", "o1", "badge.print")).toBe(false);
  });

  it("print.request : ADMIN event, OWNER, MANAGER et staff oui ; OPERATOR, PRINTER, VIEWER, AUDITOR non", () => {
    const yes = [
      baseCtx({ eventMemberships: [{ eventId: "e1", role: "ADMIN" }] }),
      baseCtx({ orgMemberships: [{ orgId: "o1", role: "OWNER" }] }),
      baseCtx({ orgMemberships: [{ orgId: "o1", role: "MANAGER" }] }),
      baseCtx({ isStaff: true, staffRole: "STAFF_OBSERVER" }),
    ];
    for (const ctx of yes) expect(hasEventPermission(ctx, "e1", "o1", "print.request")).toBe(true);
    const no = [
      baseCtx({ eventMemberships: [{ eventId: "e1", role: "OPERATOR" }] }),
      baseCtx({ eventMemberships: [{ eventId: "e1", role: "PRINTER" }] }),
      baseCtx({ eventMemberships: [{ eventId: "e1", role: "VIEWER" }] }),
      baseCtx({ orgMemberships: [{ orgId: "o1", role: "AUDITOR" }] }),
    ];
    for (const ctx of no) expect(hasEventPermission(ctx, "e1", "o1", "print.request")).toBe(false);
  });

  it("staff bypasses any event permission check", () => {
    const ctx = baseCtx({ isStaff: true, staffRole: "STAFF_OBSERVER" });
    expect(hasEventPermission(ctx, "e1", "o1", "event.read.detailed")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "registration.delete")).toBe(true);
  });

  it("no rights returns false", () => {
    expect(hasEventPermission(baseCtx(), "e1", "o1", "event.read.aggregated")).toBe(false);
  });
});
