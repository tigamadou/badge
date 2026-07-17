import { describe, it, expect } from "vitest";
import type { UserContext } from "@/types/auth";
import { resolveHomeRedirect } from "@/lib/org-redirect";

function makeCtx(partial: {
  isStaff: boolean;
  orgMemberships?: { orgId: string; role: "OWNER" | "MANAGER" | "AUDITOR" }[];
}): UserContext {
  return {
    user: { id: "u1", email: "u@x.test", name: "U" },
    isStaff: partial.isStaff,
    staffRole: partial.isStaff ? "STAFF_SUPPORT" : null,
    orgMemberships: partial.orgMemberships ?? [],
    eventMemberships: [],
  };
}

describe("resolveHomeRedirect", () => {
  it("returns /login if no userContext", () => {
    expect(resolveHomeRedirect(null, null)).toBe("/login");
  });

  it("returns /platform if user is staff with no lastOrg", () => {
    expect(resolveHomeRedirect(makeCtx({ isStaff: true }), null)).toBe("/platform");
  });

  it("returns /org/[orgId] if single org and not staff", () => {
    expect(
      resolveHomeRedirect(
        makeCtx({ isStaff: false, orgMemberships: [{ orgId: "o1", role: "OWNER" }] }),
        null,
      ),
    ).toBe("/org/o1");
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
        null,
      ),
    ).toBe("/select");
  });

  it("uses lastOrgId hint if still valid", () => {
    expect(
      resolveHomeRedirect(
        makeCtx({
          isStaff: false,
          orgMemberships: [
            { orgId: "o1", role: "OWNER" },
            { orgId: "o2", role: "OWNER" },
          ],
        }),
        "o2",
      ),
    ).toBe("/org/o2");
  });

  it("ignores lastOrgId if user lost membership", () => {
    expect(
      resolveHomeRedirect(
        makeCtx({ isStaff: false, orgMemberships: [{ orgId: "o1", role: "OWNER" }] }),
        "o-gone",
      ),
    ).toBe("/org/o1");
  });

  it("staff with lastOrgId hint goes there", () => {
    expect(resolveHomeRedirect(makeCtx({ isStaff: true }), "o-any")).toBe("/org/o-any");
  });

  it("returns /profile if not staff and no org", () => {
    expect(resolveHomeRedirect(makeCtx({ isStaff: false }), null)).toBe("/profile?message=no-org");
  });
});
