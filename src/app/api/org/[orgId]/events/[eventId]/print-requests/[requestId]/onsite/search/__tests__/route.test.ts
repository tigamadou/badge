import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedFactories } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/subscription-access", async () => {
  const { DEFAULT_RIGHTS } = await import("@/lib/subscription-rights");
  return { loadOrgAccess: vi.fn(async () => ({ active: true, maxEvents: null, maxParticipantsPerEvent: null, rights: DEFAULT_RIGHTS })) };
});
import { getServerSession } from "next-auth";
import { GET } from "../route";
import { as, callOnsite, seedOnsiteScene } from "../../__tests__/helpers";

seedFactories(2403);

let s: Awaited<ReturnType<typeof seedOnsiteScene>>;
beforeEach(async () => {
  vi.mocked(getServerSession).mockReset();
  s = await seedOnsiteScene();
});

describe("GET …/onsite/search", () => {
  it("AGENT : 200 avec les inscriptions de l'évènement seulement", async () => {
    const r = await s.order();
    as(s.agent);
    const res = await callOnsite(GET, s.scope(r.id), "/search?q=%20Alpha%20", "GET");
    expect(res.status).toBe(200);
    expect(res.json.registrations.map((x: { id: string }) => x.id)).toEqual([s.fx.approved[0].id]);
  });

  it("400 si q est absent ou trop court", async () => {
    const r = await s.order();
    as(s.agent);
    expect((await callOnsite(GET, s.scope(r.id), "/search", "GET")).status).toBe(400);
    expect((await callOnsite(GET, s.scope(r.id), "/search?q=a", "GET")).status).toBe(400);
  });

  it("401 sans session ; 403 pour AUDITOR et VIEWER", async () => {
    const r = await s.order();
    as(null);
    expect((await callOnsite(GET, s.scope(r.id), "/search?q=Alpha", "GET")).status).toBe(401);
    for (const u of [s.auditor, s.viewer]) {
      as(u);
      expect((await callOnsite(GET, s.scope(r.id), "/search?q=Alpha", "GET")).status).toBe(403);
    }
  });

  it("404 pour une commande d'un autre évènement ou d'une autre organisation", async () => {
    as(s.agent);
    expect((await callOnsite(GET, s.scope((await s.otherEventOrder()).id), "/search?q=Alpha", "GET")).status).toBe(404);
    expect((await callOnsite(GET, s.scope((await s.foreignOrgOrder()).id), "/search?q=Alpha", "GET")).status).toBe(404);
  });
});
