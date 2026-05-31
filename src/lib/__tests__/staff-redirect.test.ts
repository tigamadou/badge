import { describe, it, expect } from "vitest";
import { computeStaffRedirect } from "@/lib/staff-redirect";
import type { UserContext } from "@/types/auth";

const baseCtx = (over: Partial<UserContext> = {}): UserContext => ({
  user: { id: "u1", email: "u@x", name: "U" },
  isStaff: false,
  staffRole: null,
  orgMemberships: [],
  eventMemberships: [],
  ...over,
});

describe("computeStaffRedirect", () => {
  it("redirects staff to /staff", () => {
    const ctx = baseCtx({ isStaff: true, staffRole: "STAFF_ADMIN" });
    expect(computeStaffRedirect(ctx)).toBe("/staff");
  });

  it("redirects SUPER_ADMIN to /staff", () => {
    const ctx = baseCtx({ isStaff: true, staffRole: "SUPER_ADMIN" });
    expect(computeStaffRedirect(ctx)).toBe("/staff");
  });

  it("redirects single-org OWNER to /admin/[orgId]", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "org-1", role: "OWNER" }] });
    expect(computeStaffRedirect(ctx)).toBe("/admin/org-1");
  });

  it("redirects multi-org OWNER to /select", () => {
    const ctx = baseCtx({
      orgMemberships: [
        { orgId: "org-1", role: "OWNER" },
        { orgId: "org-2", role: "OWNER" },
      ],
    });
    expect(computeStaffRedirect(ctx)).toBe("/select");
  });

  it("redirects user with only event memberships to /select", () => {
    const ctx = baseCtx({
      eventMemberships: [{ eventId: "evt-1", role: "OPERATOR" }],
    });
    expect(computeStaffRedirect(ctx)).toBe("/select");
  });

  it("redirects user with no memberships to /profile?message=no-org", () => {
    expect(computeStaffRedirect(baseCtx())).toBe("/profile?message=no-org");
  });

  it("staff wins over org memberships", () => {
    const ctx = baseCtx({
      isStaff: true,
      staffRole: "STAFF_SUPPORT",
      orgMemberships: [{ orgId: "org-1", role: "OWNER" }],
    });
    expect(computeStaffRedirect(ctx)).toBe("/staff");
  });
});
