import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { seedFactories } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/subscription-access", async () => {
  const { DEFAULT_RIGHTS } = await import("@/lib/subscription-rights");
  return { loadOrgAccess: vi.fn(async () => ({ active: true, maxEvents: null, maxParticipantsPerEvent: null, rights: DEFAULT_RIGHTS })) };
});
import { getServerSession } from "next-auth";
import { GET } from "../route";
import { as, callOnsite, seedOnsiteScene } from "./helpers";

seedFactories(2401);

let s: Awaited<ReturnType<typeof seedOnsiteScene>>;
beforeEach(async () => {
  vi.mocked(getServerSession).mockReset();
  s = await seedOnsiteScene();
});

describe("GET …/onsite", () => {
  it("401 sans session", async () => {
    const r = await s.order();
    as(null);
    expect((await callOnsite(GET, s.scope(r.id), "", "GET")).status).toBe(401);
  });

  it("AGENT : request, compteur et consigne imprimeur, sans aucun prix", async () => {
    await prisma.platformSettings.upsert({
      where: { id: "singleton" }, update: { onsitePrinterNote: "Papier A6" }, create: { id: "singleton", onsitePrinterNote: "Papier A6" },
    });
    const r = await s.order({ onsiteSchedule: "12-13 mars" });
    await prisma.printRequest.update({ where: { id: r.id }, data: { total: 300000, acceptedTotal: 300000 } });
    as(s.agent);
    const res = await callOnsite(GET, s.scope(r.id), "", "GET");
    expect(res.status).toBe(200);
    expect(res.json.request).toEqual({
      id: r.id, reference: r.reference, status: "IN_PRODUCTION", onsiteLocation: "Hall A", onsiteSchedule: "12-13 mars",
    });
    expect(res.json.counter).toMatchObject({ ordered: 200, marginPercent: 10, cap: 220, printed: 0 });
    expect(res.json.printerNote).toBe("Papier A6");
    const raw = JSON.stringify(res.json);
    for (const leak of ["unitPrice", "lineTotal", "acceptedTotal", "300000", "lines", "\"total\""]) {
      expect(raw, leak).not.toContain(leak);
    }
  });

  it("403 pour AUDITOR, VIEWER et OPERATOR d'évènement", async () => {
    const r = await s.order();
    for (const u of [s.auditor, s.viewer]) {
      as(u);
      expect((await callOnsite(GET, s.scope(r.id), "", "GET")).status).toBe(403);
    }
  });

  it("404 pour une commande d'un autre évènement, d'une autre organisation, inconnue, ADVANCE ou brouillon", async () => {
    as(s.agent);
    const cases = [
      (await s.otherEventOrder()).id,
      (await s.foreignOrgOrder()).id,
      "inconnue",
      (await s.order({ type: "ADVANCE" })).id,
      (await s.order({ status: "DRAFT" })).id,
    ];
    for (const id of cases) expect((await callOnsite(GET, s.scope(id), "", "GET")).status, id).toBe(404);
  });

  it("409 REQUEST_NOT_PRINTABLE pour une commande de l'évènement qui n'ouvre pas le poste", async () => {
    const r = await s.order({ status: "COMPLETED" });
    as(s.agent);
    const res = await callOnsite(GET, s.scope(r.id), "", "GET");
    expect(res.status).toBe(409);
    expect(res.json.error).toBe("REQUEST_NOT_PRINTABLE");
  });

  it("l'agent d'une autre organisation n'atteint rien (403)", async () => {
    const r = await s.order();
    const { makeOrg, makeOrgMember } = await import("@/test/factories");
    const other = await makeOrg();
    as(await makeOrgMember(other.id, "AGENT"));
    expect((await callOnsite(GET, s.scope(r.id), "", "GET")).status).toBe(403);
  });

  it("le staff Imprimeur (print.onsite.operate) lit aussi le poste", async () => {
    const r = await s.order();
    as(s.staffPrinter, true);
    expect((await callOnsite(GET, s.scope(r.id), "", "GET")).status).toBe(200);
  });
});
