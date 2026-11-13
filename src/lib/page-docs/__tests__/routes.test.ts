import { describe, expect, it } from "vitest";
import { docTargetScope } from "../routes";

describe("docTargetScope", () => {
  it.each([
    ["/platform", "PLATFORM"],
    ["/platform/organizations/[orgId]/members", "PLATFORM"],
    ["/platform/users/[userId]", "PLATFORM"],
    ["/org/[orgId]/events/new", "ORG"],
    ["/event/[eventId]/registrations", "EVENT"],
    ["/account", "PARTICIPANT"],
  ])("%s -> %s", (route, scope) => {
    expect(docTargetScope(route)).toBe(scope);
  });
});
