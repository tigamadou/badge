import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedFactories } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/subscription-access", async () => {
  const { DEFAULT_RIGHTS } = await import("@/lib/subscription-rights");
  return { loadOrgAccess: vi.fn(async () => ({ active: true, maxEvents: null, maxParticipantsPerEvent: null, rights: DEFAULT_RIGHTS })) };
});
import { getServerSession } from "next-auth";
import { POST } from "../route";
import { as, callOnsite, seedOnsiteScene } from "../../__tests__/helpers";

seedFactories(2402);

let s: Awaited<ReturnType<typeof seedOnsiteScene>>;
beforeEach(async () => {
  vi.mocked(getServerSession).mockReset();
  s = await seedOnsiteScene();
});

describe("POST …/onsite/lookup", () => {
  it("AGENT : 200 avec la fiche à partir du contenu du QR", async () => {
    const r = await s.order();
    as(s.agent);
    const res = await callOnsite(POST, s.scope(r.id), "/lookup", "POST", { payload: `https://x.org/verify/${s.fx.approved[0].id}` });
    expect(res.status).toBe(200);
    expect(res.json.registration).toMatchObject({ id: s.fx.approved[0].id, status: "APPROVED" });
  });

  it("401, 403 (AUDITOR, VIEWER, OPERATOR) et 400 de validation", async () => {
    const r = await s.order();
    const body = { payload: s.fx.approved[0].id };
    as(null);
    expect((await callOnsite(POST, s.scope(r.id), "/lookup", "POST", body)).status).toBe(401);
    for (const u of [s.auditor, s.viewer]) {
      as(u);
      expect((await callOnsite(POST, s.scope(r.id), "/lookup", "POST", body)).status).toBe(403);
    }
    as(s.agent);
    expect((await callOnsite(POST, s.scope(r.id), "/lookup", "POST", { payload: "" })).status).toBe(400);
    expect((await callOnsite(POST, s.scope(r.id), "/lookup", "POST", undefined, "pas du json")).status).toBe(400);
  });

  it("404 pour une commande d'un autre évènement ou d'une autre organisation, avant toute lecture d'inscription", async () => {
    as(s.agent);
    const body = { payload: s.fx.approved[0].id };
    expect((await callOnsite(POST, s.scope((await s.otherEventOrder()).id), "/lookup", "POST", body)).status).toBe(404);
    expect((await callOnsite(POST, s.scope((await s.foreignOrgOrder()).id), "/lookup", "POST", body)).status).toBe(404);
    expect((await callOnsite(POST, s.scope("inconnue"), "/lookup", "POST", body)).status).toBe(404);
  });

  it("inscription d'un autre évènement : FOREIGN_EVENT ; inscription en attente : NOT_APPROVED", async () => {
    const r = await s.order();
    as(s.agent);
    const foreign = await callOnsite(POST, s.scope(r.id), "/lookup", "POST", { payload: s.foreignRegistration.id });
    expect(foreign.status).toBe(404);
    expect(foreign.json.error).toBe("FOREIGN_EVENT");
    const pending = await callOnsite(POST, s.scope(r.id), "/lookup", "POST", { payload: s.fx.pending.id });
    expect(pending.status).toBe(409);
    expect(pending.json.error).toBe("NOT_APPROVED");
  });
});
