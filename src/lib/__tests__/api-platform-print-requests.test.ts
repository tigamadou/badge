import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSubmittedPrintRequestCount } from "@/lib/print-requests/staff-api";
import { paymentProbe } from "@/lib/print-requests/service";
import * as templateVars from "@/lib/badge-templates/event-template-variables";
import { seedPrintFixture, makeRequest, type PrintFixture } from "./helpers/print-requests";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/badge-templates/event-template-variables", async (orig) => {
  const actual = await orig<typeof import("@/lib/badge-templates/event-template-variables")>();
  return { ...actual, findEffectiveTemplateRow: vi.fn(actual.findEffectiveTemplateRow) };
});
import { getServerSession } from "next-auth";
import { GET as listGET } from "@/app/api/platform/print/requests/route";
import { GET as detailGET } from "@/app/api/platform/print/requests/[requestId]/route";
import { POST as linesPOST } from "@/app/api/platform/print/requests/[requestId]/lines/route";
import {
  PATCH as linePATCH,
  DELETE as lineDELETE,
} from "@/app/api/platform/print/requests/[requestId]/lines/[lineId]/route";
import { POST as sendQuotePOST } from "@/app/api/platform/print/requests/[requestId]/send-quote/route";
import { POST as reopenPOST } from "@/app/api/platform/print/requests/[requestId]/reopen/route";
import { POST as rejectPOST } from "@/app/api/platform/print/requests/[requestId]/reject/route";
import { POST as statusPOST } from "@/app/api/platform/print/requests/[requestId]/status/route";
import { POST as markPaidPOST } from "@/app/api/platform/print/requests/[requestId]/mark-paid/route";
import {
  GET as messagesGET,
  POST as messagesPOST,
} from "@/app/api/platform/print/requests/[requestId]/messages/route";

type User = { id: string; email: string; name: string };
let fx: PrintFixture;

function as(user: User | null) {
  vi.mocked(getServerSession).mockResolvedValue(
    (user ? { user: { id: user.id, email: user.email, name: user.name, isStaff: true } } : null) as never,
  );
}

function request(url: string, method = "GET", body?: unknown, raw?: string) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    headers: { "content-type": "application/json" },
  });
}
const BASE = "/api/platform/print/requests";
const ctx = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params) });

type Handler = (req: NextRequest, c: ReturnType<typeof ctx>) => Promise<Response>;
async function call(handler: unknown, url: string, method: string, params: Record<string, string>, body?: unknown) {
  const res = await (handler as Handler)(request(url, method, body), ctx(params));
  return { status: res.status, json: await res.json() };
}

beforeEach(async () => {
  vi.mocked(getServerSession).mockReset();
  fx = await seedPrintFixture();
  as(fx.staffAdmin);
  // Évite l'échec (journalisé) de l'envoi d'e-mail des notifications.
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton", smtpHost: "localhost", smtpPort: 587, smtpFrom: "noreply@print.test",
      smtpUser: "", smtpPassword: "", smtpSecure: false, recaptchaEnabled: false,
      recaptchaSiteKey: "", recaptchaSecretKey: "",
    },
    update: {},
  });
});
afterEach(() => vi.restoreAllMocks());

const reload = (id: string) => prisma.printRequest.findUniqueOrThrow({ where: { id } });
const logs = (targetId: string, type: string) =>
  prisma.activityLog.findMany({ where: { targetId, type: type as never } });

async function withLine(status: "SUBMITTED" | "QUOTED" = "SUBMITTED") {
  const r = await makeRequest(fx, { status, total: 1000, quoteVersion: status === "QUOTED" ? 1 : 0 });
  const line = await prisma.printQuoteLine.create({
    data: {
      requestId: r.id, kind: "SERVICE", label: "Service", quantity: 1, unitPrice: 1000,
      lineTotal: 1000, position: 0, addedBy: "STAFF",
    },
  });
  return { r, line };
}
const lineBody = { kind: "SERVICE", label: "Livraison", quantity: 1, unitPrice: 500 };

// Une entrée par frontière de route : (nom, appel, rôle minimal).
type Route = { name: string; min: "ADMIN" | "SUPPORT" | "OBSERVER"; run: () => Promise<{ status: number; json: unknown }> };
async function routes(): Promise<Route[]> {
  const { r, line } = await withLine();
  const id = r.id;
  const u = `${BASE}/${id}`;
  return [
    { name: "list", min: "OBSERVER", run: () => call(listGET, BASE, "GET", {}) },
    { name: "detail", min: "OBSERVER", run: () => call(detailGET, u, "GET", { requestId: id }) },
    { name: "messages GET", min: "OBSERVER", run: () => call(messagesGET, `${u}/messages`, "GET", { requestId: id }) },
    { name: "messages POST", min: "SUPPORT", run: () => call(messagesPOST, `${u}/messages`, "POST", { requestId: id }, { body: "x" }) },
    { name: "status", min: "SUPPORT", run: () => call(statusPOST, `${u}/status`, "POST", { requestId: id }, { to: "READY" }) },
    { name: "reject", min: "SUPPORT", run: () => call(rejectPOST, `${u}/reject`, "POST", { requestId: id }, { reason: "Motif" }) },
    { name: "reopen", min: "ADMIN", run: () => call(reopenPOST, `${u}/reopen`, "POST", { requestId: id }) },
    { name: "lines POST", min: "ADMIN", run: () => call(linesPOST, `${u}/lines`, "POST", { requestId: id }, lineBody) },
    { name: "line PATCH", min: "ADMIN", run: () => call(linePATCH, `${u}/lines/${line.id}`, "PATCH", { requestId: id, lineId: line.id }, { unitPrice: 5 }) },
    { name: "line DELETE", min: "ADMIN", run: () => call(lineDELETE, `${u}/lines/${line.id}`, "DELETE", { requestId: id, lineId: line.id }) },
    { name: "send-quote", min: "ADMIN", run: () => call(sendQuotePOST, `${u}/send-quote`, "POST", { requestId: id }) },
    { name: "mark-paid", min: "ADMIN", run: () => call(markPaidPOST, `${u}/mark-paid`, "POST", { requestId: id }, { reason: "Virement" }) },
  ];
}

describe("gardes de rôle, une par frontière de route", () => {
  it("401 sans session, 403 pour un non-staff", async () => {
    for (const route of await routes()) {
      as(null);
      expect((await route.run()).status, `${route.name} sans session`).toBe(401);
      as(fx.owner);
      expect((await route.run()).status, `${route.name} non-staff`).toBe(403);
    }
  });

  it("403 sous le rôle minimal, jamais 403 au rôle minimal", async () => {
    const order = ["OBSERVER", "SUPPORT", "ADMIN"] as const;
    const staff = { OBSERVER: fx.staffObserver, SUPPORT: fx.staffSupport, ADMIN: fx.staffAdmin };
    for (const route of await routes()) {
      for (const role of order) {
        as(staff[role]);
        const { status } = await route.run();
        const allowed = order.indexOf(role) >= order.indexOf(route.min);
        if (allowed) expect(status, `${route.name} ${role}`).not.toBe(403);
        else expect(status, `${route.name} ${role}`).toBe(403);
      }
    }
  });
});

describe("brouillon invisible", () => {
  it("404 sur chaque route de demande", async () => {
    const draft = await makeRequest(fx, { status: "DRAFT" });
    const id = draft.id;
    const u = `${BASE}/${id}`;
    const calls = [
      call(detailGET, u, "GET", { requestId: id }),
      call(messagesGET, `${u}/messages`, "GET", { requestId: id }),
      call(messagesPOST, `${u}/messages`, "POST", { requestId: id }, { body: "x" }),
      call(linesPOST, `${u}/lines`, "POST", { requestId: id }, lineBody),
      call(linePATCH, `${u}/lines/l`, "PATCH", { requestId: id, lineId: "l" }, { unitPrice: 1 }),
      call(lineDELETE, `${u}/lines/l`, "DELETE", { requestId: id, lineId: "l" }),
      call(sendQuotePOST, `${u}/send-quote`, "POST", { requestId: id }),
      call(reopenPOST, `${u}/reopen`, "POST", { requestId: id }),
      call(rejectPOST, `${u}/reject`, "POST", { requestId: id }, { reason: "Motif" }),
      call(statusPOST, `${u}/status`, "POST", { requestId: id }, { to: "READY" }),
      call(markPaidPOST, `${u}/mark-paid`, "POST", { requestId: id }, { reason: "Virement" }),
    ];
    for (const res of await Promise.all(calls)) expect(res.status).toBe(404);
    expect((await call(detailGET, `${BASE}/inconnu`, "GET", { requestId: "inconnu" })).json).toMatchObject({
      error: "NOT_FOUND", message: expect.any(String),
    });
  });
});

describe("GET liste", () => {
  it("ne renvoie ni brouillon ni champ interne, avec le nombre de badges", async () => {
    await makeRequest(fx, { status: "DRAFT" });
    const adv = await makeRequest(fx, { status: "SUBMITTED", submittedAt: new Date("2026-11-01") });
    await prisma.printRequestItem.createMany({
      data: fx.approved.map((reg, i) => ({ requestId: adv.id, registrationId: reg.id, position: i })),
    });
    const onsite = await makeRequest(fx, {
      type: "ONSITE", status: "SUBMITTED", estimatedQuantity: 40, submittedAt: new Date("2026-11-02"),
    });
    const noQty = await makeRequest(fx, { type: "ONSITE", status: "QUOTED", submittedAt: new Date("2026-11-03") });
    const { status, json } = await call(listGET, `${BASE}?orgId=${fx.org.id}`, "GET", {});
    expect(status).toBe(200);
    expect(json.total).toBe(3);
    expect(json.page).toBe(1);
    // submittedAt décroissant.
    expect(json.requests.map((r: { id: string }) => r.id)).toEqual([noQty.id, onsite.id, adv.id]);
    const byId = Object.fromEntries(json.requests.map((r: { id: string }) => [r.id, r]));
    expect(byId[adv.id]).toMatchObject({
      badgeCount: 3, org: { id: fx.org.id, name: "Org" }, event: { id: fx.event.id, title: "Evenement" },
    });
    expect(byId[onsite.id].badgeCount).toBe(40);
    expect(byId[noQty.id].badgeCount).toBe(0);
    for (const r of json.requests) {
      expect(r).not.toHaveProperty("createdById");
      expect(r).not.toHaveProperty("paidPaymentId");
      expect(r).not.toHaveProperty("_count");
    }
  });

  it("filtres : statut, organisation, type, date souhaitée", async () => {
    const other = await seedPrintFixture();
    const a = await makeRequest(fx, { status: "SUBMITTED", wantedBy: new Date("2026-11-20T00:00:00Z") });
    const b = await makeRequest(fx, { status: "QUOTED", type: "ONSITE", wantedBy: new Date("2026-12-05T00:00:00Z") });
    const c = await makeRequest(other, { status: "SUBMITTED" });
    const ids = async (qs: string) =>
      ((await call(listGET, `${BASE}?${qs}`, "GET", {})).json.requests as { id: string }[]).map((r) => r.id);
    expect(await ids(`status=SUBMITTED&orgId=${fx.org.id}`)).toEqual([a.id]);
    expect(await ids(`orgId=${other.org.id}`)).toEqual([c.id]);
    expect(await ids(`orgId=${fx.org.id}&type=ONSITE`)).toEqual([b.id]);
    expect(await ids(`orgId=${fx.org.id}&wantedFrom=2026-12-01`)).toEqual([b.id]);
    expect(await ids(`orgId=${fx.org.id}&wantedTo=2026-11-20`)).toEqual([a.id]);
    expect(await ids(`orgId=${fx.org.id}&wantedFrom=2026-11-20&wantedTo=2026-12-05`)).toHaveLength(2);
    // Un paramètre vide est ignoré.
    expect(await ids(`orgId=${fx.org.id}&status=&page=`)).toHaveLength(2);
  });

  it("pagination par 50", async () => {
    await prisma.printRequest.createMany({
      data: Array.from({ length: 52 }, (_, i) => ({
        reference: `PG-${Date.now()}-${i}`, eventId: fx.event.id, orgId: fx.org.id, type: "ADVANCE" as const,
        status: "SUBMITTED" as const, submittedAt: new Date(2026, 0, 1, 0, i),
      })),
    });
    const p1 = (await call(listGET, `${BASE}?orgId=${fx.org.id}`, "GET", {})).json;
    const p2 = (await call(listGET, `${BASE}?orgId=${fx.org.id}&page=2`, "GET", {})).json;
    expect([p1.requests.length, p2.requests.length, p1.total, p2.page]).toEqual([50, 2, 52, 2]);
  });

  it("400 sur paramètre invalide (DRAFT, date, page)", async () => {
    for (const qs of ["status=DRAFT", "wantedFrom=demain", "page=0", "type=X"]) {
      expect((await call(listGET, `${BASE}?${qs}`, "GET", {})).status, qs).toBe(400);
    }
  });
});

describe("GET détail", () => {
  it("renvoie demande, évènement, template, items triés, lignes, planches", async () => {
    const r = await makeRequest(fx, { status: "PAID", paidPaymentId: "pay_1", marginPercent: 10 });
    // Positions inversées par rapport à l'ordre de création.
    await prisma.printRequestItem.createMany({
      data: [
        { requestId: r.id, registrationId: fx.approved[0].id, position: 2 },
        { requestId: r.id, registrationId: fx.approved[1].id, position: 0 },
        { requestId: r.id, registrationId: fx.approved[2].id, position: 1 },
      ],
    });
    await prisma.printQuoteLine.createMany({
      data: [
        { requestId: r.id, kind: "SERVICE", label: "Actif", quantity: 1, unitPrice: 10, lineTotal: 10, position: 0, addedBy: "STAFF" },
        { requestId: r.id, kind: "SERVICE", label: "Retiré", quantity: 1, unitPrice: 10, lineTotal: 10, position: 1, addedBy: "STAFF", removedAt: new Date() },
      ],
    });
    const layout = await prisma.printSheetLayout.create({
      data: {
        name: `lay-${Date.now()}`, sheetWidth: 2100, sheetHeight: 2970, sheetOrientation: "PORTRAIT",
        marginTop: 50, marginRight: 50, marginBottom: 50, marginLeft: 50, gapHorizontal: 20, gapVertical: 20,
        badgeOrientation: "AUTO", duplexFlip: "LONG_EDGE", cropMarks: true,
      },
    });
    const gen = await prisma.printSheetGeneration.create({
      data: {
        eventId: fx.event.id, layoutId: layout.id, printRequestId: r.id, status: "DONE", badgeCount: 3,
        sheetCount: 1, fileKey: "k.pdf", registrationIds: [], layoutSnapshot: {}, createdById: fx.staffAdmin.id,
      } as never,
    });
    await prisma.organization.update({
      where: { id: fx.org.id }, data: { contactEmail: "o@x.test", contactPhone: "+227 90" },
    });

    const { status, json } = await call(detailGET, `${BASE}/${r.id}`, "GET", { requestId: r.id });
    expect(status).toBe(200);
    expect(json.request).toMatchObject({ id: r.id, status: "PAID" });
    for (const hidden of ["createdById", "paidPaymentId", "marginPercent", "parentRequestId", "acceptedById"]) {
      expect(json.request).not.toHaveProperty(hidden);
    }
    expect(json.event).toMatchObject({
      id: fx.event.id, title: "Evenement", location: "Niamey",
      org: { id: fx.org.id, name: "Org", contactEmail: "o@x.test", contactPhone: "+227 90" },
    });
    expect(json.template).toMatchObject({ id: fx.template.id, label: "Badge test", widthPx: 320, heightPx: 460, pages: 2 });
    expect(json.items.map((i: { lastName: string }) => i.lastName)).toEqual(["Bravo", "Charlie", "Alpha"]);
    expect(json.items[1]).toMatchObject({
      categoryName: "Exposant", status: "APPROVED", badgePrinted: false, position: 1, firstName: "Prenom",
    });
    expect(json.lines.map((l: { label: string }) => l.label)).toEqual(["Actif"]);
    expect(json.lines[0]).not.toHaveProperty("removedAt");
    expect(json.generations).toEqual([
      expect.objectContaining({ id: gen.id, status: "DONE", badgeCount: 3, sheetCount: 1, fileKey: "k.pdf" }),
    ]);
  });

  it("copie du template de la demande prioritaire ; template introuvable -> null", async () => {
    const r = await makeRequest(fx, {
      badgeTemplateId: fx.template.id, badgeWidthPx: 300, badgeHeightPx: 400, badgePages: 1,
    });
    const copy = await call(detailGET, `${BASE}/${r.id}`, "GET", { requestId: r.id });
    expect(copy.json.template).toMatchObject({ widthPx: 300, heightPx: 400, pages: 1 });
    vi.mocked(templateVars.findEffectiveTemplateRow).mockResolvedValueOnce(null);
    const none = await call(detailGET, `${BASE}/${r.id}`, "GET", { requestId: r.id });
    expect(none.json.template).toBeNull();
  });
});

describe("lignes", () => {
  it("POST 201, journal, notification organisateur si le devis est révisé", async () => {
    const r = await makeRequest(fx, { status: "QUOTED", quoteVersion: 1 });
    const res = await call(linesPOST, `${BASE}/${r.id}/lines`, "POST", { requestId: r.id }, lineBody);
    expect(res.status).toBe(201);
    expect(res.json.line).toMatchObject({ label: "Livraison", unitPrice: 500, addedBy: "STAFF" });
    expect(res.json.line).not.toHaveProperty("removedAt");
    expect(await logs(r.id, "PRINT_REQUEST_UPDATED")).toHaveLength(1);
    expect((await reload(r.id)).status).toBe("SUBMITTED");
    const n = await prisma.notification.findMany({
      where: { userId: fx.owner.id, type: "PRINT_REQUEST_STATUS_CHANGED" },
    });
    expect(n).toHaveLength(1);
  });

  it("POST sans révision : aucune notification ; 400 sur corps invalide ou JSON cassé", async () => {
    const r = await makeRequest(fx);
    expect((await call(linesPOST, `${BASE}/${r.id}/lines`, "POST", { requestId: r.id }, lineBody)).status).toBe(201);
    expect(await prisma.notification.count({ where: { type: "PRINT_REQUEST_STATUS_CHANGED" } })).toBe(0);
    const bad = await call(linesPOST, `${BASE}/${r.id}/lines`, "POST", { requestId: r.id }, { kind: "X" });
    expect(bad).toMatchObject({ status: 400, json: { error: "VALIDATION" } });
    const broken = await linesPOST(request(`${BASE}/${r.id}/lines`, "POST", undefined, "{"), { params: Promise.resolve({ requestId: r.id }) });
    expect(broken.status).toBe(400);
  });

  it("PATCH et DELETE : journal, notification si révisé, 404 ligne inconnue", async () => {
    const { r, line } = await withLine("QUOTED");
    const patch = await call(linePATCH, `${BASE}/${r.id}/lines/${line.id}`, "PATCH",
      { requestId: r.id, lineId: line.id }, { unitPrice: 2000 });
    expect(patch.status).toBe(200);
    expect(patch.json.line).toMatchObject({ unitPrice: 2000, priceOverridden: true });
    expect((await reload(r.id)).total).toBe(2000);
    expect(await prisma.notification.count({ where: { userId: fx.owner.id, type: "PRINT_REQUEST_STATUS_CHANGED" } })).toBe(1);

    const del = await call(lineDELETE, `${BASE}/${r.id}/lines/${line.id}`, "DELETE", { requestId: r.id, lineId: line.id });
    expect(del).toMatchObject({ status: 200, json: { ok: true } });
    expect((await reload(r.id)).total).toBe(0);
    expect(await logs(r.id, "PRINT_REQUEST_UPDATED")).toHaveLength(2);

    const missing = await call(lineDELETE, `${BASE}/${r.id}/lines/zzz`, "DELETE", { requestId: r.id, lineId: "zzz" });
    expect(missing.status).toBe(404);
    const noBody = await call(linePATCH, `${BASE}/${r.id}/lines/${line.id}`, "PATCH", { requestId: r.id, lineId: line.id }, {});
    expect(noBody.status).toBe(400);
  });

  it("PATCH et DELETE sur devis non révisé (SUBMITTED) : pas de notification", async () => {
    const { r, line } = await withLine("SUBMITTED");
    await call(linePATCH, `${BASE}/${r.id}/lines/${line.id}`, "PATCH", { requestId: r.id, lineId: line.id }, { unitPrice: 1 });
    await call(lineDELETE, `${BASE}/${r.id}/lines/${line.id}`, "DELETE", { requestId: r.id, lineId: line.id });
    expect(await prisma.notification.count({ where: { type: "PRINT_REQUEST_STATUS_CHANGED" } })).toBe(0);
  });
});

describe("envoi, réouverture, refus, statut", () => {
  it("send-quote : devis envoyé, journal, notification au propriétaire", async () => {
    const { r } = await withLine();
    const res = await call(sendQuotePOST, `${BASE}/${r.id}/send-quote`, "POST", { requestId: r.id });
    expect(res.status).toBe(200);
    expect(res.json.request).toMatchObject({ status: "QUOTED", quoteVersion: 1, total: 1000 });
    expect(res.json.request).not.toHaveProperty("createdById");
    const [log] = await logs(r.id, "PRINT_REQUEST_QUOTED");
    expect(log).toMatchObject({ orgId: fx.org.id, eventId: fx.event.id, userId: fx.staffAdmin.id });
    expect(await prisma.notification.count({ where: { userId: fx.owner.id, type: "PRINT_REQUEST_QUOTED" } })).toBe(1);
  });

  it("send-quote sans ligne : 400 EMPTY_QUOTE avec message français", async () => {
    const r = await makeRequest(fx);
    const res = await call(sendQuotePOST, `${BASE}/${r.id}/send-quote`, "POST", { requestId: r.id });
    expect(res).toMatchObject({ status: 400, json: { error: "EMPTY_QUOTE", message: "Le devis ne contient aucune ligne." } });
  });

  it("reopen (STAFF_ADMIN) : ACCEPTED -> SUBMITTED, journal et notification", async () => {
    const r = await makeRequest(fx, { status: "ACCEPTED", quoteVersion: 1, acceptedVersion: 1, acceptedTotal: 10 });
    const res = await call(reopenPOST, `${BASE}/${r.id}/reopen`, "POST", { requestId: r.id });
    expect(res.json.request.status).toBe("SUBMITTED");
    expect(await logs(r.id, "PRINT_REQUEST_REOPENED")).toHaveLength(1);
    expect(await prisma.notification.count({ where: { userId: fx.owner.id, type: "PRINT_REQUEST_STATUS_CHANGED" } })).toBe(1);
  });

  it("reopen pendant un paiement : 409 PAYMENT_IN_PROGRESS", async () => {
    vi.spyOn(paymentProbe, "isPaymentInProgress").mockResolvedValue(true);
    const r = await makeRequest(fx, { status: "ACCEPTED", quoteVersion: 1, acceptedVersion: 1, acceptedTotal: 10 });
    const res = await call(reopenPOST, `${BASE}/${r.id}/reopen`, "POST", { requestId: r.id });
    expect(res).toMatchObject({ status: 409, json: { error: "PAYMENT_IN_PROGRESS" } });
  });

  it("reject (STAFF_SUPPORT) : motif obligatoire, journal avec motif, notification", async () => {
    as(fx.staffSupport);
    const r = await makeRequest(fx);
    const bad = await call(rejectPOST, `${BASE}/${r.id}/reject`, "POST", { requestId: r.id }, {});
    expect(bad.status).toBe(400);
    for (const reason of ["", "   ", "x".repeat(1001)]) {
      expect((await call(rejectPOST, `${BASE}/${r.id}/reject`, "POST", { requestId: r.id }, { reason })).status, reason.length.toString()).toBe(400);
    }
    expect((await reload(r.id)).status).toBe("SUBMITTED");
    const short = await call(rejectPOST, `${BASE}/${r.id}/reject`, "POST", { requestId: r.id }, { reason: "x" });
    expect(short.status).toBe(400);
    const res = await call(rejectPOST, `${BASE}/${r.id}/reject`, "POST", { requestId: r.id }, { reason: "  Hors périmètre  " });
    expect(res.json.request.status).toBe("REJECTED");
    const [log] = await logs(r.id, "PRINT_REQUEST_REJECTED");
    expect(log.details).toEqual({ reason: "Hors périmètre" });
    expect(await prisma.notification.count({ where: { userId: fx.owner.id, type: "PRINT_REQUEST_STATUS_CHANGED" } })).toBe(1);
  });

  it("status (STAFF_SUPPORT) : avance PAID -> IN_PRODUCTION, refuse une valeur ou transition invalide", async () => {
    as(fx.staffSupport);
    const r = await makeRequest(fx, { status: "PAID" });
    const res = await call(statusPOST, `${BASE}/${r.id}/status`, "POST", { requestId: r.id }, { to: "IN_PRODUCTION" });
    expect(res.json.request.status).toBe("IN_PRODUCTION");
    const [log] = await logs(r.id, "PRINT_REQUEST_STATUS_CHANGED");
    expect(log.details).toEqual({ from: "PAID", to: "IN_PRODUCTION" });
    expect(await prisma.notification.count({ where: { userId: fx.owner.id, type: "PRINT_REQUEST_STATUS_CHANGED" } })).toBe(1);
    expect((await call(statusPOST, `${BASE}/${r.id}/status`, "POST", { requestId: r.id }, { to: "PAID" })).status).toBe(400);
    // Le « from » du journal est le statut lu sous verrou, pas celui d'une lecture antérieure.
    const r2 = await makeRequest(fx, { status: "PAID" });
    await prisma.printRequest.update({ where: { id: r2.id }, data: { status: "IN_PRODUCTION" } });
    // Deux lectures périmées (route puis service) précèdent la lecture sous verrou.
    vi.spyOn(prisma.printRequest, "findUnique")
      .mockResolvedValueOnce({ ...r2 } as never)
      .mockResolvedValueOnce({ ...r2 } as never);
    await call(statusPOST, `${BASE}/${r2.id}/status`, "POST", { requestId: r2.id }, { to: "READY" });
    expect((await logs(r2.id, "PRINT_REQUEST_STATUS_CHANGED"))[0].details).toEqual({ from: "IN_PRODUCTION", to: "READY" });
    vi.restoreAllMocks();
    const invalid = await call(statusPOST, `${BASE}/${r.id}/status`, "POST", { requestId: r.id }, { to: "COMPLETED" });
    expect(invalid).toMatchObject({ status: 409, json: { error: "INVALID_TRANSITION" } });
  });
});

describe("template inadapté à l'impression sur place", () => {
  const setList = (ids: string[]) =>
    prisma.platformSettings.update({ where: { id: "singleton" }, data: { onsitePrintTemplateIds: ids } });
  const onsiteRequest = async (status: "SUBMITTED" | "PAID" | "IN_PRODUCTION") => {
    const r = await makeRequest(fx, { type: "ONSITE", status, total: 1000, badgeTemplateId: fx.template.id });
    await prisma.printQuoteLine.create({
      data: {
        requestId: r.id, kind: "SERVICE", label: "Service", quantity: 1, unitPrice: 1000,
        lineTotal: 1000, position: 0, addedBy: "STAFF",
      },
    });
    return r;
  };
  const advance = (id: string, to: string) =>
    call(statusPOST, `${BASE}/${id}/status`, "POST", { requestId: id }, { to });

  it("GET détail : onsiteTemplate OK / UNSUITABLE / NOT_APPLICABLE", async () => {
    const r = await onsiteRequest("SUBMITTED");
    await setList([fx.template.id]);
    expect((await call(detailGET, `${BASE}/${r.id}`, "GET", { requestId: r.id })).json.onsiteTemplate).toBe("OK");
    await setList([]);
    expect((await call(detailGET, `${BASE}/${r.id}`, "GET", { requestId: r.id })).json.onsiteTemplate).toBe("UNSUITABLE");
    const adv = await makeRequest(fx, { status: "SUBMITTED", badgeTemplateId: fx.template.id });
    expect((await call(detailGET, `${BASE}/${adv.id}`, "GET", { requestId: adv.id })).json.onsiteTemplate).toBe(
      "NOT_APPLICABLE",
    );
  });

  it("send-quote : 409 ONSITE_TEMPLATE_UNSUITABLE, statut inchangé ; passe quand le template est coché", async () => {
    await setList([]);
    const r = await onsiteRequest("SUBMITTED");
    const res = await call(sendQuotePOST, `${BASE}/${r.id}/send-quote`, "POST", { requestId: r.id });
    expect(res).toMatchObject({ status: 409, json: { error: "ONSITE_TEMPLATE_UNSUITABLE" } });
    expect((await reload(r.id)).status).toBe("SUBMITTED");
    await setList([fx.template.id]);
    expect((await call(sendQuotePOST, `${BASE}/${r.id}/send-quote`, "POST", { requestId: r.id })).status).toBe(200);
  });

  it("PAID -> IN_PRODUCTION : 409 ONSITE_TEMPLATE_UNSUITABLE, statut inchangé", async () => {
    await setList([]);
    const r = await onsiteRequest("PAID");
    const res = await advance(r.id, "IN_PRODUCTION");
    expect(res).toMatchObject({ status: 409, json: { error: "ONSITE_TEMPLATE_UNSUITABLE" } });
    expect((await reload(r.id)).status).toBe("PAID");
    await setList([fx.template.id]);
    expect((await advance(r.id, "IN_PRODUCTION")).json.request.status).toBe("IN_PRODUCTION");
  });

  it("IN_PRODUCTION -> READY bloqué ; READY -> COMPLETED reste permis", async () => {
    await setList([]);
    const r = await onsiteRequest("IN_PRODUCTION");
    const blocked = await advance(r.id, "READY");
    expect(blocked).toMatchObject({ status: 409, json: { error: "ONSITE_TEMPLATE_UNSUITABLE" } });
    expect((await reload(r.id)).status).toBe("IN_PRODUCTION");
    await setList([fx.template.id]);
    expect((await advance(r.id, "READY")).json.request.status).toBe("READY");
    await setList([]);
    await prisma.printRequest.update({ where: { id: r.id }, data: { status: "READY" } });
    expect((await advance(r.id, "COMPLETED")).json.request.status).toBe("COMPLETED");
  });

  it("template courant de l'évènement coché mais copie de la demande non cochée : UNSUITABLE", async () => {
    const other = await prisma.installedBadgeTemplate.create({
      data: {
        family: `copie-${Date.now()}`, version: 1, label: "Ancienne copie", description: "", pages: 1,
        pageWidthPx: 100, pageHeightPx: 100, layout: { variables: [] }, bindings: {},
        assetPrefix: "badge-templates/copie/", formatVersion: 3, installedById: "u1",
      },
    });
    await setList([fx.template.id]);
    const r = await onsiteRequest("PAID");
    await prisma.printRequest.update({ where: { id: r.id }, data: { badgeTemplateId: other.id } });
    const res = await advance(r.id, "IN_PRODUCTION");
    expect(res).toMatchObject({ status: 409, json: { error: "ONSITE_TEMPLATE_UNSUITABLE" } });
    expect((await call(detailGET, `${BASE}/${r.id}`, "GET", { requestId: r.id })).json.onsiteTemplate).toBe("UNSUITABLE");
  });

  it("refus d'une demande SUBMITTED toujours permis", async () => {
    await setList([]);
    const r = await onsiteRequest("SUBMITTED");
    const res = await call(rejectPOST, `${BASE}/${r.id}/reject`, "POST", { requestId: r.id }, { reason: "Motif" });
    expect(res.status).toBe(200);
    expect((await reload(r.id)).status).toBe("REJECTED");
  });
});

describe("mark-paid", () => {
  const acceptedRequest = () =>
    makeRequest(fx, { status: "ACCEPTED", quoteVersion: 1, acceptedVersion: 1, acceptedTotal: 1000 });

  it("sans motif ou motif trop court : 400", async () => {
    const r = await acceptedRequest();
    for (const body of [{}, { reason: "" }, { reason: "ab" }, { reason: "x".repeat(501) }]) {
      expect((await call(markPaidPOST, `${BASE}/${r.id}/mark-paid`, "POST", { requestId: r.id }, body)).status).toBe(400);
    }
    expect((await reload(r.id)).status).toBe("ACCEPTED");
  });

  it("paiement manuel : PAID, journal avec motif, notification organisateur et staff", async () => {
    const r = await acceptedRequest();
    const res = await call(markPaidPOST, `${BASE}/${r.id}/mark-paid`, "POST", { requestId: r.id }, { reason: " Virement reçu " });
    expect(res.status).toBe(200);
    expect(res.json.request.status).toBe("PAID");
    expect(res.json.request).not.toHaveProperty("paidPaymentId");
    const [log] = await logs(r.id, "PRINT_REQUEST_MARKED_PAID");
    expect(log.details).toEqual({ reason: "Virement reçu" });
    expect((await reload(r.id)).paidPaymentId).toBeNull();
    // Message du marquage hors ligne (plan 34), pas la notification de changement de statut.
    const manualBody = `La demande ${r.reference} (${fx.event.title}) a été marquée payée par l'équipe Badge.`;
    const ownerNotifs = await prisma.notification.findMany({ where: { userId: fx.eventAdmin.id, type: "PRINT_REQUEST_STATUS_CHANGED" } });
    expect(ownerNotifs.map((n) => n.body)).toEqual([manualBody]);
    // Le staff est notifié, sauf l'acteur lui-même : un autre STAFF_ADMIN la reçoit.
    const other = await prisma.user.create({
      data: { email: `adm-${Date.now()}@x.test`, password: "x", name: "A2", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    const r2 = await acceptedRequest();
    await call(markPaidPOST, `${BASE}/${r2.id}/mark-paid`, "POST", { requestId: r2.id }, { reason: "Espèces" });
    const staffNotifs = await prisma.notification.findMany({ where: { userId: other.id, type: "PRINT_REQUEST_STATUS_CHANGED" } });
    expect(staffNotifs).toHaveLength(1);
    expect(staffNotifs[0].body).toContain("a été marquée payée par l'équipe Badge.");
  });

  it("paiement réel en cours (Payment PENDING, sonde non espionnée) : 409 et demande inchangée", async () => {
    const r = await acceptedRequest();
    await prisma.payment.create({
      data: { orgId: fx.org.id, purpose: "PRINT_REQUEST", printRequestId: r.id, amount: 1000, status: "PENDING" },
    });
    const res = await call(markPaidPOST, `${BASE}/${r.id}/mark-paid`, "POST", { requestId: r.id }, { reason: "Virement" });
    expect(res).toMatchObject({ status: 409, json: { error: "PAYMENT_IN_PROGRESS" } });
    const after = await reload(r.id);
    expect(after).toMatchObject({ status: "ACCEPTED", paidPaymentId: null });
    expect(await logs(r.id, "PRINT_REQUEST_MARKED_PAID")).toHaveLength(0);
  });

  it("409 PAYMENT_IN_PROGRESS et INVALID_TRANSITION", async () => {
    const r = await acceptedRequest();
    vi.spyOn(paymentProbe, "isPaymentInProgress").mockResolvedValue(true);
    const busy = await call(markPaidPOST, `${BASE}/${r.id}/mark-paid`, "POST", { requestId: r.id }, { reason: "Virement" });
    expect(busy).toMatchObject({ status: 409, json: { error: "PAYMENT_IN_PROGRESS" } });
    vi.restoreAllMocks();
    const sub = await makeRequest(fx);
    const bad = await call(markPaidPOST, `${BASE}/${sub.id}/mark-paid`, "POST", { requestId: sub.id }, { reason: "Virement" });
    expect(bad).toMatchObject({ status: 409, json: { error: "INVALID_TRANSITION" } });
  });
});

describe("messages", () => {
  it("POST staff : 201, entrée du fil, notification aux admins de l'évènement et pas au staff", async () => {
    as(fx.staffSupport);
    const r = await makeRequest(fx);
    const res = await call(messagesPOST, `${BASE}/${r.id}/messages`, "POST", { requestId: r.id }, { body: "Bonjour" });
    expect(res.status).toBe(201);
    expect(res.json.entry).toMatchObject({
      side: "STAFF", kind: "MESSAGE", body: "Bonjour", attachmentKey: null, authorName: "staffSupport",
    });
    expect(Date.parse(res.json.entry.createdAt)).not.toBeNaN();
    const notified = await prisma.notification.findMany({ where: { type: "PRINT_REQUEST_MESSAGE" } });
    const recipients = notified.map((n) => n.userId);
    expect(recipients).toContain(fx.owner.id);
    expect(recipients).toContain(fx.eventAdmin.id);
    expect(recipients).not.toContain(fx.staffAdmin.id);
    expect(recipients).not.toContain(fx.staffSupport.id);
  });

  it("POST avec pièce jointe valide, clé invalide -> 400, corps absent -> 400", async () => {
    const r = await makeRequest(fx);
    const url = `${BASE}/${r.id}/messages`;
    const ok = await call(messagesPOST, url, "POST", { requestId: r.id }, { body: "", attachmentKey: "print-requests/staff/f.pdf" });
    expect(ok.json.entry.attachmentKey).toBe("print-requests/staff/f.pdf");
    const bad = await call(messagesPOST, url, "POST", { requestId: r.id }, { body: "x", attachmentKey: "print-requests/autre/f.pdf" });
    expect(bad).toMatchObject({ status: 400, json: { error: "INVALID_ATTACHMENT" } });
    expect((await call(messagesPOST, url, "POST", { requestId: r.id }, {})).status).toBe(400);
  });

  it("GET : le fil complet, trié", async () => {
    as(fx.staffObserver);
    const r = await makeRequest(fx);
    await prisma.printRequestMessage.createMany({
      data: [
        { requestId: r.id, side: "ORGANIZER", kind: "MESSAGE", body: "Un", authorId: fx.owner.id },
        { requestId: r.id, side: "SYSTEM", kind: "EVENT", body: "Deux", eventType: "SUBMITTED" },
      ],
    });
    const res = await call(messagesGET, `${BASE}/${r.id}/messages`, "GET", { requestId: r.id });
    expect(res.status).toBe(200);
    expect(res.json.entries.map((e: { body: string }) => e.body)).toEqual(["Un", "Deux"]);
    expect(res.json.entries[0].authorName).toBe("owner");
  });
});

describe("erreurs inattendues et session sans nom", () => {
  it("une erreur autre que PrintRequestError est relancée", async () => {
    const r = await makeRequest(fx);
    vi.spyOn(prisma.printRequest, "findUnique").mockRejectedValueOnce(new Error("boom"));
    await expect(detailGET(request(`${BASE}/${r.id}`), ctx({ requestId: r.id }) as never)).rejects.toThrow("boom");
  });

  it("message : auteur sans nom dans la session -> authorName null", async () => {
    const r = await makeRequest(fx);
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: fx.staffSupport.id, email: "s@x.test", isStaff: true },
    } as never);
    const res = await call(messagesPOST, `${BASE}/${r.id}/messages`, "POST", { requestId: r.id }, { body: "Salut" });
    expect(res.json.entry.authorName).toBeNull();
  });
});

describe("suppression d'une ligne d'un devis envoyé", () => {
  it("DELETE sur QUOTED : le devis est révisé et l'organisateur est notifié", async () => {
    const { r, line } = await withLine("QUOTED");
    const res = await call(lineDELETE, `${BASE}/${r.id}/lines/${line.id}`, "DELETE", { requestId: r.id, lineId: line.id });
    expect(res.status).toBe(200);
    expect((await reload(r.id)).status).toBe("SUBMITTED");
    expect(await prisma.notification.count({ where: { userId: fx.owner.id, type: "PRINT_REQUEST_STATUS_CHANGED" } })).toBe(1);
  });
});

describe("getSubmittedPrintRequestCount", () => {
  it("compte les demandes SUBMITTED, pas les autres statuts", async () => {
    const before = await getSubmittedPrintRequestCount();
    await makeRequest(fx);
    await makeRequest(fx, { status: "QUOTED" });
    await makeRequest(fx, { status: "DRAFT" });
    expect(await getSubmittedPrintRequestCount()).toBe(before + 1);
  });
});
