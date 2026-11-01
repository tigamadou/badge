import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedPrintFixture, makeRequest, type PrintFixture } from "./helpers/print-requests";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/mail", () => ({ sendBadgePrintedNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notifications/triggers", () => ({ notifyBadgePrinted: vi.fn().mockResolvedValue(undefined) }));
import { getServerSession } from "next-auth";
import { POST as lookupPOST } from "@/app/api/platform/print/requests/[requestId]/onsite/lookup/route";
import { GET as searchGET } from "@/app/api/platform/print/requests/[requestId]/onsite/search/route";
import { POST as printPOST } from "@/app/api/platform/print/requests/[requestId]/onsite/print/route";
import { PATCH as marginPATCH } from "@/app/api/platform/print/requests/[requestId]/onsite/margin/route";

type User = { id: string; email: string; name: string };
let fx: PrintFixture;

function as(user: User | null) {
  vi.mocked(getServerSession).mockResolvedValue(
    (user ? { user: { id: user.id, email: user.email, name: user.name, isStaff: true } } : null) as never,
  );
}

type Handler = (req: NextRequest, c: { params: Promise<Record<string, string>> }) => Promise<Response>;
async function call(handler: unknown, id: string, path: string, method: string, body?: unknown, raw?: string) {
  const req = new NextRequest(`http://localhost/api/platform/print/requests/${id}/onsite/${path}`, {
    method,
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    headers: { "content-type": "application/json" },
  });
  const res = await (handler as Handler)(req, { params: Promise.resolve({ requestId: id }) });
  return { status: res.status, json: await res.json() };
}

// Demande IN_PRODUCTION de 200 badges, marge 10 %.
async function onsite(printed = 0, over: Parameters<typeof makeRequest>[1] = {}) {
  const r = await makeRequest(fx, {
    type: "ONSITE", status: "IN_PRODUCTION", estimatedQuantity: 200, marginPercent: 10, ...over,
  });
  await prisma.printQuoteLine.create({
    data: {
      requestId: r.id, kind: "PRODUCT", productId: fx.badgeProduct.id, label: "Badge",
      quantity: 200, unitPrice: 1500, lineTotal: 300000, position: 0, addedBy: "ORGANIZER",
    },
  });
  if (printed > 0) {
    await prisma.printRequestPrint.createMany({
      data: Array.from({ length: printed }, () => ({ requestId: r.id, registrationId: null, reprint: false })),
    });
  }
  return r;
}

beforeEach(async () => {
  vi.mocked(getServerSession).mockReset();
  fx = await seedPrintFixture();
  as(fx.staffSupport);
});

const logs = (type: string) => prisma.activityLog.findMany({ where: { type: type as never } });

describe("gardes de rôle", () => {
  it("401 sans session, 403 non-staff et rôle inférieur", async () => {
    const r = await onsite();
    const runs: [string, "SUPPORT" | "ADMIN", () => Promise<{ status: number }>][] = [
      ["lookup", "SUPPORT", () => call(lookupPOST, r.id, "lookup", "POST", { payload: fx.approved[0].id })],
      ["search", "SUPPORT", () => call(searchGET, r.id, "search?q=Al", "GET")],
      ["print", "SUPPORT", () => call(printPOST, r.id, "print", "POST", { registrationId: fx.approved[0].id })],
      ["margin", "ADMIN", () => call(marginPATCH, r.id, "margin", "PATCH", { marginPercent: 15, reason: "Motif" })],
    ];
    for (const [name, min, run] of runs) {
      as(null);
      expect((await run()).status, `${name} sans session`).toBe(401);
      as(fx.owner);
      expect((await run()).status, `${name} non-staff`).toBe(403);
      as(fx.staffObserver);
      expect((await run()).status, `${name} observateur`).toBe(403);
      as(fx.staffSupport);
      const support = (await run()).status;
      if (min === "ADMIN") expect(support, `${name} support`).toBe(403);
      else expect(support, `${name} support`).not.toBe(403);
    }
  });
});

describe("POST lookup", () => {
  it("200 avec la fiche, 400 corps invalide, 404 demande inconnue", async () => {
    const r = await onsite();
    const ok = await call(lookupPOST, r.id, "lookup", "POST", { payload: `https://x.org/verify/${fx.approved[0].id}` });
    expect(ok.status).toBe(200);
    expect(ok.json.registration).toMatchObject({ id: fx.approved[0].id, status: "APPROVED" });
    expect((await call(lookupPOST, r.id, "lookup", "POST", { payload: "" })).status).toBe(400);
    expect((await call(lookupPOST, r.id, "lookup", "POST", undefined, "pas du json")).status).toBe(400);
    expect((await call(lookupPOST, "inconnue", "lookup", "POST", { payload: "x" })).status).toBe(404);
  });
});

describe("GET search", () => {
  it("200 avec les inscriptions, 400 si q absent, trop court ou trop long", async () => {
    const r = await onsite();
    const ok = await call(searchGET, r.id, "search?q=%20Alpha%20", "GET");
    expect(ok.status).toBe(200);
    expect(ok.json.registrations.map((x: { id: string }) => x.id)).toEqual([fx.approved[0].id]);
    expect((await call(searchGET, r.id, "search", "GET")).status).toBe(400);
    expect((await call(searchGET, r.id, "search?q=a", "GET")).status).toBe(400);
    expect((await call(searchGET, r.id, "search?q=%20a%20", "GET")).status).toBe(400);
    expect((await call(searchGET, r.id, `search?q=${"a".repeat(101)}`, "GET")).status).toBe(400);
    expect((await call(searchGET, r.id, `search?q=${"a".repeat(100)}`, "GET")).status).toBe(200);
  });

  it("les jokers % et _ sont cherchés tels quels", async () => {
    const r = await onsite();
    expect((await call(searchGET, r.id, "search?q=%25%25", "GET")).json.registrations).toEqual([]);
    expect((await call(searchGET, r.id, "search?q=Al_h", "GET")).json.registrations).toEqual([]);
    expect((await call(searchGET, r.id, "search?q=Al%25", "GET")).json.registrations).toEqual([]);
  });
});

describe("POST print", () => {
  it("201 : impression, pdfUrl, journal BADGE_PRINTED", async () => {
    const r = await onsite();
    const reg = fx.approved[0];
    const res = await call(printPOST, r.id, "print", "POST", { registrationId: reg.id });
    expect(res.status).toBe(201);
    expect(res.json.print).toMatchObject({ requestId: r.id, registrationId: reg.id, reprint: false });
    expect(res.json.counter).toMatchObject({ printed: 1, cap: 220 });
    expect(res.json.pdfUrl).toBe(`/api/org/${fx.org.id}/events/${fx.event.id}/badges/${reg.id}`);
    const [log] = await logs("BADGE_PRINTED");
    expect(log).toMatchObject({ targetId: reg.id, userId: fx.staffSupport.id });
    expect(log.details).toEqual({ printRequestId: r.id, onsite: true, reprint: false });
  });

  it("réimpression confirmée : reprint true dans le journal", async () => {
    const r = await onsite();
    const reg = fx.approved[0];
    await call(printPOST, r.id, "print", "POST", { registrationId: reg.id });
    const again = await call(printPOST, r.id, "print", "POST", { registrationId: reg.id });
    expect(again.status).toBe(409);
    expect(again.json.code).toBe("ALREADY_PRINTED");
    const re = await call(printPOST, r.id, "print", "POST", { registrationId: reg.id, confirmReprint: true });
    expect(re.status).toBe(201);
    expect(re.json.print.reprint).toBe(true);
    expect((await logs("BADGE_PRINTED")).map((l) => (l.details as { reprint: boolean }).reprint)).toEqual([false, true]);
  });

  it("400 corps invalide, 404 demande inconnue, 409 CAP_REACHED relayé", async () => {
    const r = await onsite(220);
    expect((await call(printPOST, r.id, "print", "POST", {})).status).toBe(400);
    expect((await call(printPOST, "inconnue", "print", "POST", { registrationId: fx.approved[0].id })).status).toBe(404);
    const res = await call(printPOST, r.id, "print", "POST", { registrationId: fx.approved[0].id });
    expect(res.status).toBe(409);
    expect(res.json.code).toBe("CAP_REACHED");
    expect(await logs("BADGE_PRINTED")).toHaveLength(0);
  });
});

describe("PATCH margin", () => {
  beforeEach(() => as(fx.staffAdmin));
  const patch = (id: string, body: unknown) => call(marginPATCH, id, "margin", "PATCH", body);

  it("200 : 200 commandés, 220 comptés, 10 -> 15 % donne un plafond de 230, fil et journal", async () => {
    const r = await onsite(220);
    const res = await patch(r.id, { marginPercent: 15, reason: " Badges abîmés " });
    expect(res.status).toBe(200);
    expect(res.json.counter).toMatchObject({ ordered: 200, marginPercent: 15, cap: 230, printed: 220 });
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).marginPercent).toBe(15);
    const [msg] = await prisma.printRequestMessage.findMany({ where: { requestId: r.id, eventType: "ONSITE_MARGIN_CHANGED" } });
    expect(msg.details).toEqual({ from: 10, to: 15, reason: "Badges abîmés" });
    expect(msg.body).toBe("Marge : 10 % → 15 % (Badges abîmés)");
    expect(msg).toMatchObject({ side: "STAFF", authorId: fx.staffAdmin.id });
    const [log] = await logs("PRINT_REQUEST_MARGIN_RAISED");
    expect(log.details).toEqual({ from: 10, to: 15, reason: "Badges abîmés" });
    expect(log.targetId).toBe(r.id);
  });

  it("une baisse au-dessus du compteur passe", async () => {
    const r = await onsite(205);
    const res = await patch(r.id, { marginPercent: 5, reason: "Motif" });
    expect(res.status).toBe(200);
    expect(res.json.counter.cap).toBe(210);
  });

  it("409 MARGIN_BELOW_PRINTED sous le compteur, rien n'est modifié", async () => {
    const r = await onsite(220);
    const res = await patch(r.id, { marginPercent: 5, reason: "Motif" });
    expect(res.status).toBe(409);
    expect(res.json.code).toBe("MARGIN_BELOW_PRINTED");
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).marginPercent).toBe(10);
    expect(await logs("PRINT_REQUEST_MARGIN_RAISED")).toHaveLength(0);
  });

  it("400 : motif absent ou trop court, marge hors bornes ou non entière", async () => {
    const r = await onsite();
    for (const body of [
      { marginPercent: 15 },
      { marginPercent: 15, reason: "ab" },
      { marginPercent: 15, reason: "a".repeat(501) },
      { marginPercent: -1, reason: "Motif" },
      { marginPercent: 101, reason: "Motif" },
      { marginPercent: 1.5, reason: "Motif" },
    ]) {
      expect((await patch(r.id, body)).status).toBe(400);
    }
  });

  it("404 demande inconnue, 409 NOT_ONSITE pour une demande en amont", async () => {
    expect((await patch("inconnue", { marginPercent: 15, reason: "Motif" })).status).toBe(404);
    const adv = await makeRequest(fx, { type: "ADVANCE", status: "IN_PRODUCTION" });
    const res = await patch(adv.id, { marginPercent: 15, reason: "Motif" });
    expect(res.status).toBe(409);
    expect(res.json.code).toBe("NOT_ONSITE");
  });
});
