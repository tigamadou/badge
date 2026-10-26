import { describe, it, expect } from "vitest";
import {
  parseScopeQuery,
  scopeToSearchParams,
  notificationsPagePath,
  type NotificationScopeRef,
} from "../scope";

describe("scope", () => {
  it("parse les quatre portées valides", () => {
    expect(parseScopeQuery(new URLSearchParams("scope=org&orgId=o1"))).toEqual({ kind: "org", orgId: "o1" });
    expect(parseScopeQuery(new URLSearchParams("scope=event&eventId=e1"))).toEqual({ kind: "event", eventId: "e1" });
    expect(parseScopeQuery(new URLSearchParams("scope=platform"))).toEqual({ kind: "platform" });
    expect(parseScopeQuery(new URLSearchParams("scope=participant"))).toEqual({ kind: "participant" });
  });

  it("renvoie null pour une portée inconnue, absente, ou sans identifiant requis", () => {
    for (const q of ["scope=foo", "", "scope=org", "scope=event&orgId=x"]) {
      expect(parseScopeQuery(new URLSearchParams(q))).toBeNull();
    }
  });

  it("scopeToSearchParams est l'inverse de parseScopeQuery", () => {
    const refs: NotificationScopeRef[] = [
      { kind: "platform" },
      { kind: "org", orgId: "o1" },
      { kind: "event", eventId: "e1" },
      { kind: "participant" },
    ];
    for (const ref of refs) {
      expect(parseScopeQuery(scopeToSearchParams(ref))).toEqual(ref);
    }
  });

  it("notificationsPagePath", () => {
    expect(notificationsPagePath({ kind: "platform" })).toBe("/platform/notifications");
    expect(notificationsPagePath({ kind: "org", orgId: "o1" })).toBe("/org/o1/notifications");
    expect(notificationsPagePath({ kind: "event", eventId: "e1" })).toBe("/event/e1/notifications");
    expect(notificationsPagePath({ kind: "participant" })).toBe("/account/notifications");
  });
});
