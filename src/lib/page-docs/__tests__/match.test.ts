import { describe, expect, it, vi } from "vitest";

vi.mock("@/content/page-docs/index.generated", async () => ({
  PAGE_DOC_INDEX: (await import("./fixtures")).FIXTURE_INDEX,
}));
import { matchDocRoute } from "../match";

describe("matchDocRoute", () => {
  it("apparie une route dynamique et extrait ses paramètres", () => {
    expect(matchDocRoute("/org/abc123/events/new")).toEqual({ id: "org/events/new", params: { orgId: "abc123" } });
    expect(matchDocRoute("/org/abc123")).toEqual({ id: "org/index", params: { orgId: "abc123" } });
    expect(matchDocRoute("/platform/organizations")).toEqual({ id: "platform/organizations", params: {} });
    expect(matchDocRoute("/account")).toEqual({ id: "account/index", params: {} });
  });

  it("tolère query, hash et slash final", () => {
    expect(matchDocRoute("/org/abc/events/new/?a=1#x")?.id).toBe("org/events/new");
    expect(matchDocRoute("/org/abc?tab=2")?.id).toBe("org/index");
    expect(matchDocRoute("/org/abc#ancre")?.id).toBe("org/index");
  });

  it("une route statique l'emporte sur une route dynamique de même forme", () => {
    expect(matchDocRoute("/event/ev1/print/onsite")?.id).toBe("event/print/onsite");
    expect(matchDocRoute("/event/ev1/print/req9")).toEqual({
      id: "event/print/detail",
      params: { eventId: "ev1", requestId: "req9" },
    });
  });

  it("renvoie null pour un chemin sans doc ou hors des espaces connectés", () => {
    for (const path of ["/org/abc/unknown", "/e/slug", "/login", "/api/page-docs", "/", "", "org/abc", "/org", "/platform/organizations/x/y"]) {
      expect(matchDocRoute(path), path).toBeNull();
    }
  });

  it("refuse les traversées de chemin et les valeurs d'identifiant suspectes", () => {
    for (const path of ["/org/../events/new", "/org/./events/new", "/org/a%2Fb", "/org/a..b/events/new", "/org/a b", "/org/a\\b"]) {
      expect(matchDocRoute(path), path).toBeNull();
    }
  });
});
