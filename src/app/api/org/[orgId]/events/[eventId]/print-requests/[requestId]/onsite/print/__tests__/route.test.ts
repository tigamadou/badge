import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { seedFactories } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/mail", () => ({ sendBadgePrintedNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notifications/triggers", () => ({ notifyBadgePrinted: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/subscription-access", async () => {
  const { DEFAULT_RIGHTS } = await import("@/lib/subscription-rights");
  return { loadOrgAccess: vi.fn(async () => ({ active: true, maxEvents: null, maxParticipantsPerEvent: null, rights: DEFAULT_RIGHTS })) };
});
vi.mock("@/lib/activity-log", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/activity-log")>();
  return { ...actual, logActivity: vi.fn(actual.logActivity) };
});
import { getServerSession } from "next-auth";
import { logActivity } from "@/lib/activity-log";
import { POST } from "../route";
import { as, callOnsite, seedOnsiteScene } from "../../__tests__/helpers";

seedFactories(2404);

let s: Awaited<ReturnType<typeof seedOnsiteScene>>;
beforeEach(async () => {
  vi.mocked(getServerSession).mockReset();
  s = await seedOnsiteScene();
});

const printBody = (registrationId: string, confirmReprint?: boolean) => ({ registrationId, confirmReprint });

describe("POST …/onsite/print", () => {
  it("AGENT : 201, impression comptée, journaux PrintRequestPrint et BADGE_PRINTED", async () => {
    const r = await s.order();
    const reg = s.fx.approved[0];
    as(s.agent);
    const res = await callOnsite(POST, s.scope(r.id), "/print", "POST", printBody(reg.id));
    expect(res.status).toBe(201);
    expect(res.json.print).toMatchObject({ requestId: r.id, registrationId: reg.id, reprint: false });
    expect(res.json.counter).toMatchObject({ printed: 1, cap: 220 });
    expect(res.json.pdfUrl).toBe(`/api/org/${s.fx.org.id}/events/${s.fx.event.id}/badges/${reg.id}`);
    expect(await prisma.printRequestPrint.count({ where: { requestId: r.id } })).toBe(1);
    const log = await prisma.activityLog.findFirst({ where: { type: "BADGE_PRINTED" } });
    expect(log).toMatchObject({ targetId: reg.id, userId: s.agent.id, orgId: s.fx.org.id, eventId: s.fx.event.id });
    expect(log?.details).toEqual({ printRequestId: r.id, onsite: true, reprint: false });
  });

  it("seconde impression sans confirmation : refus ; confirmée : réimpression non comptée", async () => {
    const r = await s.order();
    const reg = s.fx.approved[0];
    as(s.agent);
    await callOnsite(POST, s.scope(r.id), "/print", "POST", printBody(reg.id));
    const again = await callOnsite(POST, s.scope(r.id), "/print", "POST", printBody(reg.id));
    expect(again.status).toBe(409);
    expect(again.json.error).toBe("ALREADY_PRINTED");
    const confirmed = await callOnsite(POST, s.scope(r.id), "/print", "POST", printBody(reg.id, true));
    expect(confirmed.status).toBe(201);
    expect(confirmed.json.print.reprint).toBe(true);
    expect(confirmed.json.counter.printed).toBe(1);
  });

  it("409 CAP_REACHED quand le plafond est atteint", async () => {
    const r = await s.order({ estimatedQuantity: 1, marginPercent: 0 });
    await prisma.printQuoteLine.updateMany({ where: { requestId: r.id }, data: { quantity: 1 } });
    await prisma.printRequestPrint.create({ data: { requestId: r.id, registrationId: null, reprint: false } });
    as(s.agent);
    const res = await callOnsite(POST, s.scope(r.id), "/print", "POST", printBody(s.fx.approved[1].id));
    expect(res.status).toBe(409);
    expect(res.json.error).toBe("CAP_REACHED");
  });

  it("inscription d'un autre évènement : FOREIGN_EVENT ; inscription en attente : NOT_APPROVED", async () => {
    const r = await s.order();
    as(s.agent);
    const foreign = await callOnsite(POST, s.scope(r.id), "/print", "POST", printBody(s.foreignRegistration.id));
    expect(foreign.json.error).toBe("FOREIGN_EVENT");
    const pending = await callOnsite(POST, s.scope(r.id), "/print", "POST", printBody(s.fx.pending.id));
    expect(pending.json.error).toBe("NOT_APPROVED");
    expect(await prisma.printRequestPrint.count()).toBe(0);
  });

  it("404 : commande d'un autre évènement, d'une autre organisation, ADVANCE ; aucune impression écrite", async () => {
    as(s.agent);
    const ids = [(await s.otherEventOrder()).id, (await s.foreignOrgOrder()).id, (await s.order({ type: "ADVANCE" })).id];
    for (const id of ids) {
      expect((await callOnsite(POST, s.scope(id), "/print", "POST", printBody(s.fx.approved[0].id))).status, id).toBe(404);
    }
    expect(await prisma.printRequestPrint.count()).toBe(0);
  });

  it("401 sans session ; 403 pour AUDITOR, VIEWER ; 400 corps invalide", async () => {
    const r = await s.order();
    as(null);
    expect((await callOnsite(POST, s.scope(r.id), "/print", "POST", printBody(s.fx.approved[0].id))).status).toBe(401);
    for (const u of [s.auditor, s.viewer]) {
      as(u);
      expect((await callOnsite(POST, s.scope(r.id), "/print", "POST", printBody(s.fx.approved[0].id))).status).toBe(403);
    }
    as(s.agent);
    expect((await callOnsite(POST, s.scope(r.id), "/print", "POST", { registrationId: "" })).status).toBe(400);
  });

  it("l'échec du journal BADGE_PRINTED n'annule pas l'impression", async () => {
    const r = await s.order();
    vi.mocked(logActivity).mockRejectedValueOnce(new Error("journal indisponible"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    as(s.agent);
    const res = await callOnsite(POST, s.scope(r.id), "/print", "POST", printBody(s.fx.approved[0].id));
    expect(res.status).toBe(201);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("images de l'évènement non conformes : réponse dédiée, rien d'imprimé", async () => {
    const compliance = await import("@/lib/event-image-compliance");
    const r = await s.order();
    const spy = vi.spyOn(await import("@/lib/print-requests/onsite-station"), "recordOnsitePrint").mockRejectedValueOnce(
      new compliance.EventImagesNoncompliantError([{ slot: "logo", problem: "MISSING" } as never]),
    );
    as(s.agent);
    const res = await callOnsite(POST, s.scope(r.id), "/print", "POST", printBody(s.fx.approved[0].id));
    expect(res.status).toBe(422);
    expect(await prisma.printRequestPrint.count()).toBe(0);
    spy.mockRestore();
  });
});
