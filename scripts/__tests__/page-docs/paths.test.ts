import path from "node:path";
import { describe, expect, it } from "vitest";
import { assignDocIds, discoverPages, docFileForRoute, docIdForRoute } from "../../page-docs/paths";

describe("docIdForRoute", () => {
  it.each([
    ["/org/[orgId]/events/new", "org/events/new"],
    ["/org/[orgId]", "org/index"],
    ["/event/[eventId]", "event/index"],
    ["/platform", "platform/index"],
    ["/account", "account/index"],
    ["/platform/users", "platform/users"],
    ["/platform/users/[userId]", "platform/users/detail"],
    ["/org/[orgId]/events/[eventId]", "org/events/detail"],
    ["/platform/organizations/[orgId]/members", "platform/organizations/members"],
    ["/org/[orgId]/members/[userId]/permissions", "org/members/permissions"],
  ])("%s -> %s", (route, id) => {
    expect(docIdForRoute(route)).toBe(id);
  });

  it("calcule le chemin du fichier de doc", () => {
    expect(docFileForRoute("/org/[orgId]/events/new")).toBe("src/content/page-docs/org/events/new.md");
  });

  it("désambiguïse les collisions en gardant le nom de l'identifiant dynamique", () => {
    const ids = assignDocIds([
      "/event/[eventId]/print/[requestId]/onsite",
      "/event/[eventId]/print/onsite",
      "/event/[eventId]/print/[requestId]",
      "/event/[eventId]/print/[requestId]/x/[a]",
      "/event/[eventId]/print/x/[b]",
    ]);
    expect(ids.get("/event/[eventId]/print/onsite")).toBe("event/print/onsite");
    expect(ids.get("/event/[eventId]/print/[requestId]/onsite")).toBe("event/print/requestId/onsite");
    expect(ids.get("/event/[eventId]/print/[requestId]")).toBe("event/print/detail");
    expect(ids.get("/event/[eventId]/print/x/[b]")).toBe("event/print/x/detail");
    expect(ids.get("/event/[eventId]/print/[requestId]/x/[a]")).toBe("event/print/requestId/x/detail");
  });

  it("aucune collision de chemin sur les pages réelles", () => {
    const pages = discoverPages(path.resolve(__dirname, "../../.."));
    expect(pages.length).toBeGreaterThan(50);
    const ids = [...assignDocIds(pages.map((p) => p.route)).values()];
    const doublons = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(doublons).toEqual([]);
  });
});
