import { describe, it, expect } from "vitest";
import type { UserContext } from "@/types/auth";
import { resolveHomeRedirect } from "@/lib/org-redirect";

function makeCtx(partial: {
  isStaff: boolean;
  orgMemberships?: { orgId: string; role: "OWNER" | "MANAGER" | "AUDITOR" }[];
  eventMemberships?: { eventId: string; role: "ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER" }[];
}): UserContext {
  return {
    user: { id: "u1", email: "u@x.test", name: "U" },
    isStaff: partial.isStaff,
    staffRole: partial.isStaff ? "STAFF_SUPPORT" : null,
    platformRole: null,
    overrides: [],
    orgMemberships: (partial.orgMemberships ?? []).map((m) => ({ ...m, roleId: null, roleRef: null })),
    eventMemberships: (partial.eventMemberships ?? []).map((m) => ({ ...m, roleId: null, roleRef: null })),
  };
}

describe("resolveHomeRedirect", () => {
  it("returns /login if no userContext", () => {
    expect(resolveHomeRedirect(null)).toBe("/login");
  });

  it("returns /platform if staff-only (single workspace)", () => {
    expect(resolveHomeRedirect(makeCtx({ isStaff: true }))).toBe("/platform");
  });

  it("returns /org/[orgId] if single org and not staff", () => {
    expect(
      resolveHomeRedirect(makeCtx({ isStaff: false, orgMemberships: [{ orgId: "o1", role: "OWNER" }] })),
    ).toBe("/org/o1");
  });

  it("returns /event/[eventId] if single event membership and no org", () => {
    expect(
      resolveHomeRedirect(makeCtx({ isStaff: false, eventMemberships: [{ eventId: "e1", role: "OPERATOR" }] })),
    ).toBe("/event/e1");
  });

  it("returns /select if multi-org and not staff", () => {
    expect(
      resolveHomeRedirect(
        makeCtx({
          isStaff: false,
          orgMemberships: [
            { orgId: "o1", role: "OWNER" },
            { orgId: "o2", role: "OWNER" },
          ],
        }),
      ),
    ).toBe("/select");
  });

  it("returns /select if staff also member of an org (multiple workspaces)", () => {
    expect(
      resolveHomeRedirect(makeCtx({ isStaff: true, orgMemberships: [{ orgId: "o1", role: "OWNER" }] })),
    ).toBe("/select");
  });

  it("returns /select if org membership and a separate event membership", () => {
    expect(
      resolveHomeRedirect(
        makeCtx({
          isStaff: false,
          orgMemberships: [{ orgId: "o1", role: "AUDITOR" }],
          eventMemberships: [{ eventId: "e9", role: "PRINTER" }],
        }),
      ),
    ).toBe("/select");
  });

  it("returns /account if not staff and no workspace", () => {
    expect(resolveHomeRedirect(makeCtx({ isStaff: false }))).toBe("/account");
  });
});
