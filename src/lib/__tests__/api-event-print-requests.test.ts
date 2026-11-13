import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedPrintFixture, makeRequest, type PrintFixture } from "./helpers/print-requests";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
// Les gardes d'abonnement sont couverts ailleurs : l'organisation est considérée active.
vi.mock("@/lib/subscription-access", async () => {
  const { DEFAULT_RIGHTS } = await import("@/lib/subscription-rights");
  return {
    loadOrgAccess: vi.fn(async () => ({
      active: true,
      maxEvents: null,
      maxParticipantsPerEvent: null,
      rights: DEFAULT_RIGHTS,
    })),
  };
});
vi.mock("@/lib/jobs/enqueue-email", async (orig) => ({
  ...(await orig<typeof import("@/lib/jobs/enqueue-email")>()),
  enqueueEmail: vi.fn(async () => undefined),
}));
import { getServerSession } from "next-auth";
import * as list from "@/app/api/org/[orgId]/events/[eventId]/print-requests/route";
import * as detail from "@/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/route";
import * as registrations from "@/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/registrations/route";
import * as badges from "@/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/badges/route";
import * as products from "@/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/products/route";
import * as submit from "@/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/submit/route";
import * as eligibility from "@/app/api/org/[orgId]/events/[eventId]/print-requests/onsite-eligibility/route";
import * as cancel from "@/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/cancel/route";
import * as accept from "@/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/accept/route";
import * as messages from "@/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/messages/route";
import { POST as uploadPost } from "@/app/api/org/[orgId]/events/[eventId]/print-requests/upload/route";

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
type User = { id: string; email: string; name: string };

let fx: PrintFixture;
beforeEach(async () => {
  vi.mocked(getServerSession).mockReset();
  fx = await seedPrintFixture();
  await loginAs(fx.eventAdmin);
});

async function loginAs(user: User | null, isStaff = false) {
  vi.mocked(getServerSession).mockResolvedValue(
    user ? ({ user: { id: user.id, email: user.email, name: user.name, isStaff } } as never) : null,
  );
}
const asStaff = () => loginAs(fx.staffAdmin, true);

async function call(
  handler: Handler,
  method: string,
  opts: { requestId?: string; body?: unknown; eventId?: string; orgId?: string } = {},
) {
  const orgId = opts.orgId ?? fx.org.id;
  const eventId = opts.eventId ?? fx.event.id;
  const req = new NextRequest(`http://localhost/api/org/${orgId}/events/${eventId}/print-requests`, {
    method,
    headers: { "content-type": "application/json" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const params: Record<string, string> = { orgId, eventId };
  if (opts.requestId) params.requestId = opts.requestId;
  return handler(req, { params: Promise.resolve(params) });
}

const logs = (type: string) => prisma.activityLog.findMany({ where: { type: type as never, eventId: fx.event.id } });

// Toutes les routes avec une commande en brouillon prête et un corps valide.
const ROUTES: { name: string; handler: () => Handler; method: string; body?: unknown; needsRequest: boolean }[] = [
  { name: "GET liste", handler: () => list.GET as Handler, method: "GET", needsRequest: false },
  { name: "POST création", handler: () => list.POST as Handler, method: "POST", body: { type: "ADVANCE" }, needsRequest: false },
  { name: "GET détail", handler: () => detail.GET as Handler, method: "GET", needsRequest: true },
  { name: "PATCH détail", handler: () => detail.PATCH as Handler, method: "PATCH", body: { notes: "n" }, needsRequest: true },
  { name: "GET inscriptions", handler: () => registrations.GET as Handler, method: "GET", needsRequest: true },
  { name: "PUT badges", handler: () => badges.PUT as Handler, method: "PUT", body: { selection: { mode: "ALL_AVAILABLE" } }, needsRequest: true },
  { name: "PUT produits", handler: () => products.PUT as Handler, method: "PUT", body: { products: [] }, needsRequest: true },
  { name: "POST envoi", handler: () => submit.POST as Handler, method: "POST", needsRequest: true },
  { name: "POST annulation", handler: () => cancel.POST as Handler, method: "POST", needsRequest: true },
  { name: "POST acceptation", handler: () => accept.POST as Handler, method: "POST", body: { version: 1 }, needsRequest: true },
  { name: "GET messages", handler: () => messages.GET as Handler, method: "GET", needsRequest: true },
  { name: "POST message", handler: () => messages.POST as Handler, method: "POST", body: { body: "Bonjour" }, needsRequest: true },
];

describe("contrôle d'accès commun", () => {
  for (const route of ROUTES) {
    it(`${route.name} : 401 sans session`, async () => {
      await loginAs(null);
      const r = await makeRequest(fx, { status: "DRAFT" });
      const res = await call(route.handler(), route.method, { requestId: r.id, body: route.body });
      expect(res.status).toBe(401);
    });

    it(`${route.name} : 403 pour un OPERATOR`, async () => {
      await loginAs(fx.operator);
      const r = await makeRequest(fx, { status: "DRAFT" });
      const res = await call(route.handler(), route.method, { requestId: r.id, body: route.body });
      expect(res.status).toBe(403);
    });

    if (route.method !== "GET") {
      it(`${route.name} : 403 STAFF_FORBIDDEN pour le staff`, async () => {
        await asStaff();
        const r = await makeRequest(fx, { status: "DRAFT" });
        const res = await call(route.handler(), route.method, { requestId: r.id, body: route.body });
        expect(res.status).toBe(403);
        expect((await res.json()).error).toBe("STAFF_FORBIDDEN");
      });
    }

    if (route.needsRequest) {
      it(`${route.name} : 404 pour une commande d'un autre évènement`, async () => {
        const other = await prisma.event.create({
          data: { orgId: fx.org.id, title: "Autre", slug: `o-${Date.now()}-${Math.random()}`, location: "L", date: new Date() },
        });
        const r = await makeRequest(fx, { status: "DRAFT", eventId: other.id });
        const res = await call(route.handler(), route.method, { requestId: r.id, body: route.body });
        expect(res.status).toBe(404);
        expect((await res.json()).error).toBe("NOT_FOUND");
      });
    }
  }

  it("le staff peut lire la liste", async () => {
    await asStaff();
    expect((await call(list.GET as Handler, "GET")).status).toBe(200);
  });
});

describe("liste et création", () => {
  it("GET : commandes récentes d'abord, brouillons compris, nombre de badges", async () => {
    const a = await makeRequest(fx, { status: "DRAFT", reference: "IMP-A" });
    await prisma.printRequestItem.create({ data: { requestId: a.id, registrationId: fx.approved[0].id, position: 0 } });
    await new Promise((r) => setTimeout(r, 15));
    const b = await makeRequest(fx, { status: "SUBMITTED", type: "ONSITE", estimatedQuantity: 40, reference: "IMP-B" });
    const body = await (await call(list.GET as Handler, "GET")).json();
    expect(body.requests.map((x: { id: string }) => x.id)).toEqual([b.id, a.id]);
    expect(body.requests[0]).toMatchObject({ reference: "IMP-B", type: "ONSITE", badgeCount: 40, total: 0 });
    expect(body.requests[1].badgeCount).toBe(1);
  });

  it("GET : un ONSITE sans quantité estimée compte 0 badge", async () => {
    await makeRequest(fx, { status: "DRAFT", type: "ONSITE" });
    const body = await (await call(list.GET as Handler, "GET")).json();
    expect(body.requests[0].badgeCount).toBe(0);
  });

  it("GET : ne renvoie jamais les commandes d'un autre évènement", async () => {
    const other = await prisma.event.create({
      data: { orgId: fx.org.id, title: "Autre", slug: `o-${Date.now()}-${Math.random()}`, location: "L", date: new Date() },
    });
    await makeRequest(fx, { status: "SUBMITTED", eventId: other.id });
    const mine = await makeRequest(fx, { status: "SUBMITTED" });
    const body = await (await call(list.GET as Handler, "GET")).json();
    expect(body.requests.map((x: { id: string }) => x.id)).toEqual([mine.id]);
  });

  it("GET et PATCH : aucun champ interne dans la commande ni dans les lignes", async () => {
    const r = await makeRequest(fx, {
      status: "QUOTED", quoteVersion: 1, marginPercent: 20, paidPaymentId: "pay", templatePinned: true,
      acceptedById: fx.owner.id,
    });
    await prisma.printQuoteLine.create({
      data: { requestId: r.id, kind: "CUSTOM", label: "L", quantity: 1, unitPrice: 10, lineTotal: 10, position: 0, addedBy: "STAFF" },
    });
    const internal = [
      "createdById", "acceptedById", "paidPaymentId", "marginPercent", "parentRequestId", "templatePinned",
      "badgeTemplateId", "orgId",
    ];
    const got = await (await call(detail.GET as Handler, "GET", { requestId: r.id })).json();
    for (const key of internal) expect(got.request).not.toHaveProperty(key);
    expect(got.request).toMatchObject({ id: r.id, reference: r.reference, quoteVersion: 1 });
    expect(got.lines[0]).not.toHaveProperty("requestId");
    expect(got.lines[0]).toMatchObject({ label: "L", lineTotal: 10 });
    const patched = await (await call(detail.PATCH as Handler, "PATCH", { requestId: r.id, body: { notes: "z" } })).json();
    for (const key of internal) expect(patched.request).not.toHaveProperty(key);
    const listed = await (await call(list.GET as Handler, "GET")).json();
    for (const key of internal) expect(listed.requests[0]).not.toHaveProperty(key);
  });

  it("GET sur évènement archivé : 200", async () => {
    await prisma.event.update({ where: { id: fx.event.id }, data: { archived: true } });
    expect((await call(list.GET as Handler, "GET")).status).toBe(200);
  });

  it("POST : 201 et brouillon créé", async () => {
    const res = await call(list.POST as Handler, "POST", { body: { type: "ONSITE" } });
    expect(res.status).toBe(201);
    const { request } = await res.json();
    expect(request).toMatchObject({ status: "DRAFT", type: "ONSITE", eventId: fx.event.id });
  });

  it("POST : 400 VALIDATION (type inconnu ou corps absent)", async () => {
    const bad = await call(list.POST as Handler, "POST", { body: { type: "X" } });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("VALIDATION");
    const none = await call(list.POST as Handler, "POST");
    expect(none.status).toBe(400);
  });

  it("POST sur évènement archivé : 410", async () => {
    await prisma.event.update({ where: { id: fx.event.id }, data: { archived: true } });
    expect((await call(list.POST as Handler, "POST", { body: { type: "ADVANCE" } })).status).toBe(410);
  });
});

describe("détail et modification", () => {
  it("GET : lignes actives triées, nombre de badges, canAccept faux hors devis", async () => {
    const r = await makeRequest(fx, { status: "DRAFT" });
    await prisma.printQuoteLine.createMany({
      data: [
        { requestId: r.id, kind: "CUSTOM", label: "B", quantity: 1, unitPrice: 10, lineTotal: 10, position: 1, addedBy: "STAFF" },
        { requestId: r.id, kind: "CUSTOM", label: "A", quantity: 1, unitPrice: 10, lineTotal: 10, position: 0, addedBy: "STAFF" },
        { requestId: r.id, kind: "CUSTOM", label: "X", quantity: 1, unitPrice: 10, lineTotal: 10, position: 2, addedBy: "STAFF", removedAt: new Date() },
      ],
    });
    const body = await (await call(detail.GET as Handler, "GET", { requestId: r.id })).json();
    expect(body.lines.map((l: { label: string }) => l.label)).toEqual(["A", "B"]);
    expect(body).toMatchObject({ badgeCount: 0, canAccept: false });
    expect(body.request.id).toBe(r.id);
  });

  it("GET : onsiteTemplate NOT_APPLICABLE (en amont), OK puis UNSUITABLE (sur place)", async () => {
    const advance = await makeRequest(fx, { status: "DRAFT" });
    const get = async (id: string) => (await (await call(detail.GET as Handler, "GET", { requestId: id })).json()).request.onsiteTemplate;
    expect(await get(advance.id)).toBe("NOT_APPLICABLE");
    const onsite = await makeRequest(fx, { status: "SUBMITTED", type: "ONSITE", badgeTemplateId: fx.template.id });
    const setList = (ids: string[]) =>
      prisma.platformSettings.update({ where: { id: "singleton" }, data: { onsitePrintTemplateIds: ids } });
    await setList([fx.template.id]);
    expect(await get(onsite.id)).toBe("OK");
    await setList([]);
    expect(await get(onsite.id)).toBe("UNSUITABLE");
  });

  it("GET : canAccept vrai pour l'OWNER sur QUOTED, faux pour un MANAGER, faux pour le staff", async () => {
    const r = await makeRequest(fx, { status: "QUOTED", quoteVersion: 1 });
    await loginAs(fx.owner);
    expect((await (await call(detail.GET as Handler, "GET", { requestId: r.id })).json()).canAccept).toBe(true);
    await loginAs(fx.manager);
    expect((await (await call(detail.GET as Handler, "GET", { requestId: r.id })).json()).canAccept).toBe(false);
    await asStaff();
    expect((await (await call(detail.GET as Handler, "GET", { requestId: r.id })).json()).canAccept).toBe(false);
  });

  it("PATCH sur un brouillon : 200 sans journal", async () => {
    const r = await makeRequest(fx, { status: "DRAFT" });
    const res = await call(detail.PATCH as Handler, "PATCH", { requestId: r.id, body: { notes: "Urgent" } });
    expect(res.status).toBe(200);
    expect((await res.json()).request.notes).toBe("Urgent");
    expect(await logs("PRINT_REQUEST_UPDATED")).toHaveLength(0);
  });

  it("PATCH : 400 VALIDATION", async () => {
    const r = await makeRequest(fx, { status: "DRAFT" });
    const res = await call(detail.PATCH as Handler, "PATCH", { requestId: r.id, body: { delivery: "X" } });
    expect(res.status).toBe(400);
  });

  it("PATCH sur un devis : journal, révision, statut notifié au staff", async () => {
    const r = await makeRequest(fx, { status: "QUOTED", quoteVersion: 1 });
    const res = await call(detail.PATCH as Handler, "PATCH", { requestId: r.id, body: { notes: "Changement" } });
    expect(res.status).toBe(200);
    expect((await res.json()).request.status).toBe("SUBMITTED");
    expect(await logs("PRINT_REQUEST_UPDATED")).toHaveLength(1);
    expect(await prisma.notification.count({ where: { type: "PRINT_REQUEST_STATUS_CHANGED", userId: fx.staffAdmin.id } })).toBe(1);
  });

  it("PATCH sur une commande envoyée sans révision : journal sans notification", async () => {
    const r = await makeRequest(fx, { status: "SUBMITTED" });
    const res = await call(detail.PATCH as Handler, "PATCH", { requestId: r.id, body: { notes: "Précision" } });
    expect(res.status).toBe(200);
    expect(await logs("PRINT_REQUEST_UPDATED")).toHaveLength(1);
    expect(await prisma.notification.count({ where: { type: "PRINT_REQUEST_STATUS_CHANGED", userId: fx.staffAdmin.id } })).toBe(0);
  });

  it("PATCH sur évènement archivé : 410", async () => {
    const r = await makeRequest(fx, { status: "DRAFT" });
    await prisma.event.update({ where: { id: fx.event.id }, data: { archived: true } });
    expect((await call(detail.PATCH as Handler, "PATCH", { requestId: r.id, body: { notes: "x" } })).status).toBe(410);
  });

  it("PATCH sur une commande annulée : 409", async () => {
    const r = await makeRequest(fx, { status: "CANCELLED" });
    const res = await call(detail.PATCH as Handler, "PATCH", { requestId: r.id, body: { notes: "x" } });
    expect(res.status).toBe(409);
  });
});

describe("inscriptions, badges, produits", () => {
  it("GET inscriptions : candidats", async () => {
    const r = await makeRequest(fx, { status: "DRAFT" });
    const res = await call(registrations.GET as Handler, "GET", { requestId: r.id });
    expect(res.status).toBe(200);
    expect((await res.json()).candidates).toHaveLength(3);
  });

  it("GET inscriptions scope=items : tranche paginée des badges de cette commande", async () => {
    const r = await makeRequest(fx, { status: "DRAFT" });
    const other = await makeRequest(fx, { status: "DRAFT" });
    await prisma.printRequestItem.createMany({
      data: [
        { requestId: r.id, registrationId: fx.approved[0].id, position: 0 },
        { requestId: r.id, registrationId: fx.approved[1].id, position: 1 },
        { requestId: r.id, registrationId: fx.approved[2].id, position: 2 },
        { requestId: other.id, registrationId: fx.approved[0].id, position: 0 },
      ],
    });
    const req = (query: string) =>
      new NextRequest(`http://localhost/api/org/${fx.org.id}/events/${fx.event.id}/print-requests/${r.id}/registrations${query}`);
    const ctx = { params: Promise.resolve({ orgId: fx.org.id, eventId: fx.event.id, requestId: r.id }) };
    const page = await (registrations.GET as Handler)(req("?scope=items&pageSize=10&page=1&q=bravo"), ctx);
    expect(page.status).toBe(200);
    const body = await page.json();
    expect(body).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(body.items[0]).toMatchObject({ registrationId: fx.approved[1].id, position: 1, categoryName: "Participant" });
    expect(body.candidates).toBeUndefined();
    const all = await (await (registrations.GET as Handler)(req("?scope=items"), ctx)).json();
    expect(all.total).toBe(3);
  });

  it("PUT badges : 200 et nombre ; 400 sans sélection ; journal sur commande envoyée", async () => {
    const r = await makeRequest(fx, { status: "DRAFT" });
    const ok = await call(badges.PUT as Handler, "PUT", { requestId: r.id, body: { selection: { mode: "ALL_AVAILABLE" } } });
    expect(ok.status).toBe(200);
    expect((await ok.json()).count).toBe(3);
    const bad = await call(badges.PUT as Handler, "PUT", { requestId: r.id, body: { selection: { mode: "NOPE" } } });
    expect(bad.status).toBe(400);
    expect(await logs("PRINT_REQUEST_UPDATED")).toHaveLength(0);

    const sent = await makeRequest(fx, { status: "SUBMITTED" });
    const upd = await call(badges.PUT as Handler, "PUT", {
      requestId: sent.id,
      body: { selection: { mode: "IDS", registrationIds: [fx.approved[0].id] } },
    });
    expect(upd.status).toBe(200);
    expect(await logs("PRINT_REQUEST_UPDATED")).toHaveLength(1);
  });

  it("PUT produits : lignes et total ; 400 sur corps invalide ; 400 PRODUCT_UNAVAILABLE", async () => {
    const r = await makeRequest(fx, { status: "DRAFT", estimatedQuantity: 10 });
    await prisma.printRequestItem.create({ data: { requestId: r.id, registrationId: fx.approved[0].id, position: 0 } });
    const ok = await call(products.PUT as Handler, "PUT", {
      requestId: r.id,
      body: { products: [{ productId: fx.badgeProduct.id, quantity: null, choices: [] }] },
    });
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.lines).toHaveLength(1);
    expect(body.total).toBe(1500);
    const forced = await call(products.PUT as Handler, "PUT", {
      requestId: r.id,
      body: {
        products: [
          { productId: fx.badgeProduct.id, quantity: null, choices: [] },
          { productId: fx.lanyard.id, quantity: 999, choices: [] },
        ],
      },
    });
    expect(forced.status).toBe(200);
    expect((await forced.json()).lines[1].quantity).toBe(1);
    expect((await call(products.PUT as Handler, "PUT", { requestId: r.id, body: { products: "x" } })).status).toBe(400);
    const missing = await call(products.PUT as Handler, "PUT", {
      requestId: r.id,
      body: { products: [{ productId: "nope", quantity: 1, choices: [] }] },
    });
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe("PRODUCT_UNAVAILABLE");
  });
});

describe("envoi, annulation", () => {
  it("submit : 409 INVALID_TRANSITION sur une commande déjà envoyée", async () => {
    const r = await makeRequest(fx, { status: "SUBMITTED" });
    const res = await call(submit.POST as Handler, "POST", { requestId: r.id });
    expect(res.status).toBe(409);
  });

  it("submit ONSITE avec un template hors liste : 409 ONSITE_TEMPLATE_UNSUITABLE, commande inchangée", async () => {
    await prisma.platformSettings.update({ where: { id: "singleton" }, data: { onsitePrintTemplateIds: [] } });
    const r = await makeRequest(fx, {
      type: "ONSITE", status: "DRAFT", estimatedQuantity: 20, onsiteLocation: "Hall",
      onsiteContactName: "M", onsiteContactPhone: "1", onsiteSchedule: [{ date: "2026-11-02", from: "09:00", to: "18:00" }],
    });
    await prisma.printQuoteLine.create({
      data: {
        requestId: r.id, kind: "PRODUCT", productId: fx.badgeProduct.id, label: "Support", quantity: 20,
        unitPrice: 1500, lineTotal: 30000, position: 0, addedBy: "ORGANIZER",
      },
    });
    const res = await call(submit.POST as Handler, "POST", { requestId: r.id });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: "ONSITE_TEMPLATE_UNSUITABLE",
      message: "Le modèle de badge de cet évènement n'est pas adapté à l'impression sur place.",
    });
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("DRAFT");
  });

  it("onsite-eligibility : éligible, non éligible, sans template, accès refusé", async () => {
    const setList = (ids: string[]) =>
      prisma.platformSettings.update({ where: { id: "singleton" }, data: { onsitePrintTemplateIds: ids } });
    const get = () => call(eligibility.GET as Handler, "GET");
    await setList([fx.template.id]);
    expect(await (await get()).json()).toEqual({ eligible: true, templateId: fx.template.id });
    await setList([]);
    expect(await (await get()).json()).toEqual({ eligible: false, templateId: fx.template.id });
    await prisma.event.update({ where: { id: fx.event.id }, data: { badgeTemplateId: "inconnu" } });
    await prisma.installedBadgeTemplate.deleteMany({});
    const none = await get();
    expect([none.status, await none.json()]).toEqual([200, { eligible: false, templateId: null }]);
    await loginAs(null);
    expect((await get()).status).toBe(401);
  });

  it("submit sur évènement archivé : 410", async () => {
    const r = await makeRequest(fx, { status: "DRAFT" });
    await prisma.event.update({ where: { id: fx.event.id }, data: { archived: true } });
    expect((await call(submit.POST as Handler, "POST", { requestId: r.id })).status).toBe(410);
  });

  it("cancel : brouillon sans notification ; commande envoyée avec notification ; autorisé sur évènement archivé", async () => {
    const draft = await makeRequest(fx, { status: "DRAFT" });
    const res = await call(cancel.POST as Handler, "POST", { requestId: draft.id });
    expect(res.status).toBe(200);
    expect((await res.json()).request.status).toBe("CANCELLED");
    expect(await prisma.notification.count({ where: { type: "PRINT_REQUEST_STATUS_CHANGED", userId: fx.staffAdmin.id } })).toBe(0);

    await prisma.event.update({ where: { id: fx.event.id }, data: { archived: true } });
    const sent = await makeRequest(fx, { status: "SUBMITTED" });
    expect((await call(cancel.POST as Handler, "POST", { requestId: sent.id })).status).toBe(200);
    expect(await logs("PRINT_REQUEST_CANCELLED")).toHaveLength(2);
    expect(await prisma.notification.count({ where: { type: "PRINT_REQUEST_STATUS_CHANGED", userId: fx.staffAdmin.id } })).toBe(1);
  });

  it("cancel : 409 sur une commande déjà annulée", async () => {
    const r = await makeRequest(fx, { status: "CANCELLED" });
    expect((await call(cancel.POST as Handler, "POST", { requestId: r.id })).status).toBe(409);
  });
});

describe("acceptation", () => {
  it("MANAGER : 403 OWNER_REQUIRED", async () => {
    const r = await makeRequest(fx, { status: "QUOTED", quoteVersion: 1 });
    await loginAs(fx.manager);
    const res = await call(accept.POST as Handler, "POST", { requestId: r.id, body: { version: 1 } });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("OWNER_REQUIRED");
  });

  it("staff SUPER_ADMIN : 403 STAFF_FORBIDDEN avant toute lecture", async () => {
    const root = await prisma.user.create({
      data: { email: `sa-${Date.now()}@x.test`, password: "x", name: "SA", isStaff: true, staffRole: "SUPER_ADMIN" },
    });
    await loginAs(root, true);
    const res = await call(accept.POST as Handler, "POST", { requestId: "inconnu", body: { version: 1 } });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("STAFF_FORBIDDEN");
  });

  it("OWNER : 200, journal PRINT_REQUEST_ACCEPTED, statut notifié", async () => {
    const r = await makeRequest(fx, { status: "QUOTED", quoteVersion: 2, total: 5000 });
    await loginAs(fx.owner);
    const res = await call(accept.POST as Handler, "POST", { requestId: r.id, body: { version: 2 } });
    expect(res.status).toBe(200);
    expect((await res.json()).request).toMatchObject({ status: "ACCEPTED", acceptedVersion: 2, acceptedTotal: 5000 });
    expect(await logs("PRINT_REQUEST_ACCEPTED")).toHaveLength(1);
    // Le staff est prévenu une seule fois (par acceptQuote), l'organisateur par la route.
    const mine = { type: "PRINT_REQUEST_STATUS_CHANGED" as const };
    expect(await prisma.notification.count({ where: { ...mine, userId: fx.staffAdmin.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { ...mine, userId: fx.eventAdmin.id } })).toBe(1);
  });

  it("OWNER : devis à 0 couvert par le crédit -> PAID, l'organisateur n'est prévenu que par la notification de paiement", async () => {
    const r = await makeRequest(fx, { status: "QUOTED", quoteVersion: 1, total: 0 });
    await prisma.printQuoteLine.create({
      data: {
        requestId: r.id, kind: "DISCOUNT", label: "Crédit d'impression", quantity: 1, unitPrice: -3000,
        lineTotal: -3000, position: 0, addedBy: "STAFF", usesOrgCredit: true,
      },
    });
    await prisma.orgPrintCredit.create({ data: { orgId: fx.org.id, kind: "EARNED", amount: 3000 } });
    await loginAs(fx.owner);
    const res = await call(accept.POST as Handler, "POST", { requestId: r.id, body: { version: 1 } });
    expect(res.status).toBe(200);
    expect((await res.json()).request).toMatchObject({ status: "PAID", acceptedTotal: 0 });
    expect(await prisma.orgPrintCredit.count({ where: { requestId: r.id, kind: "SPENT" } })).toBe(1);
    expect(await prisma.notification.count({ where: { type: "PRINT_REQUEST_STATUS_CHANGED", userId: fx.eventAdmin.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { type: "PRINT_REQUEST_STATUS_CHANGED", userId: fx.staffAdmin.id } })).toBe(1);
  });

  it("OWNER : 409 si la version a changé ; 400 sans version ; autorisé sur évènement archivé", async () => {
    const r = await makeRequest(fx, { status: "QUOTED", quoteVersion: 2 });
    await loginAs(fx.owner);
    const stale = await call(accept.POST as Handler, "POST", { requestId: r.id, body: { version: 1 } });
    expect(stale.status).toBe(409);
    expect((await stale.json()).error).toBe("QUOTE_VERSION_MISMATCH");
    expect((await call(accept.POST as Handler, "POST", { requestId: r.id, body: {} })).status).toBe(400);
    await prisma.event.update({ where: { id: fx.event.id }, data: { archived: true } });
    expect((await call(accept.POST as Handler, "POST", { requestId: r.id, body: { version: 2 } })).status).toBe(200);
  });
});

describe("messages", () => {
  it("POST : 201, entrée du fil, notification au staff ; GET la liste", async () => {
    const r = await makeRequest(fx, { status: "SUBMITTED" });
    const res = await call(messages.POST as Handler, "POST", { requestId: r.id, body: { body: "  Bonjour  " } });
    expect(res.status).toBe(201);
    const { entry } = await res.json();
    expect(entry).toMatchObject({ side: "ORGANIZER", kind: "MESSAGE", body: "Bonjour", attachmentKey: null });
    expect(await prisma.notification.count({ where: { type: "PRINT_REQUEST_MESSAGE", userId: fx.staffAdmin.id } })).toBe(1);
    const got = await (await call(messages.GET as Handler, "GET", { requestId: r.id })).json();
    expect(got.entries.map((e: { id: string }) => e.id)).toEqual([entry.id]);
  });

  it("POST : pièce jointe valide ; clé invalide -> 400 INVALID_ATTACHMENT ; corps vide -> 400", async () => {
    const r = await makeRequest(fx, { status: "SUBMITTED" });
    const key = `print-requests/${fx.event.id}/a.pdf`;
    const ok = await call(messages.POST as Handler, "POST", { requestId: r.id, body: { body: "", attachmentKey: key } });
    expect(ok.status).toBe(201);
    expect((await ok.json()).entry.attachmentKey).toBe(key);
    const bad = await call(messages.POST as Handler, "POST", {
      requestId: r.id,
      body: { body: "x", attachmentKey: "print-requests/autre/a.pdf" },
    });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("INVALID_ATTACHMENT");
    expect((await call(messages.POST as Handler, "POST", { requestId: r.id, body: { body: " " } })).status).toBe(400);
    expect((await call(messages.POST as Handler, "POST", { requestId: r.id, body: { nope: 1 } })).status).toBe(400);
  });

  it("POST sur un brouillon : 409, aucune entrée ni notification au staff", async () => {
    const r = await makeRequest(fx, { status: "DRAFT" });
    const res = await call(messages.POST as Handler, "POST", { requestId: r.id, body: { body: "Bonjour" } });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("INVALID_TRANSITION");
    expect(await prisma.printRequestMessage.count({ where: { requestId: r.id } })).toBe(0);
    expect(await prisma.notification.count({ where: { type: "PRINT_REQUEST_MESSAGE" } })).toBe(0);
  });

  it("GET : les détails internes du fil (paiement, génération, motif manuel) ne sont pas exposés", async () => {
    const r = await makeRequest(fx, { status: "PAID" });
    await prisma.printRequestMessage.create({
      data: {
        requestId: r.id, side: "STAFF", kind: "EVENT", eventType: "PAYMENT_RECEIVED",
        body: "Paiement reçu : 1 000 FCFA (hors ligne : Virement interne)",
        details: { amount: 1000, paymentId: "pay_interne", reason: "Virement interne" },
      },
    });
    const { entries } = await (await call(messages.GET as Handler, "GET", { requestId: r.id })).json();
    expect(entries).toHaveLength(1);
    expect(entries[0].details).toEqual({ amount: 1000 });
    expect(JSON.stringify(entries)).not.toMatch(/pay_interne|Virement/);
  });

  it("GET et POST autorisés sur évènement archivé", async () => {
    const r = await makeRequest(fx, { status: "SUBMITTED" });
    await prisma.event.update({ where: { id: fx.event.id }, data: { archived: true } });
    expect((await call(messages.GET as Handler, "GET", { requestId: r.id })).status).toBe(200);
    expect((await call(messages.POST as Handler, "POST", { requestId: r.id, body: { body: "ok" } })).status).toBe(201);
  });

  it("le staff lit le fil", async () => {
    const r = await makeRequest(fx, { status: "SUBMITTED" });
    await asStaff();
    expect((await call(messages.GET as Handler, "GET", { requestId: r.id })).status).toBe(200);
  });
});

describe("upload : refus du staff", () => {
  it("403 STAFF_FORBIDDEN", async () => {
    await asStaff();
    const fd = new FormData();
    fd.append("file", new Blob(["abc"], { type: "application/pdf" }), "a.pdf");
    const req = new NextRequest("http://localhost/x", { method: "POST", body: fd });
    const res = await uploadPost(req, { params: Promise.resolve({ orgId: fx.org.id, eventId: fx.event.id }) });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("STAFF_FORBIDDEN");
  });
});

describe("parcours complet : brouillon -> envoi", () => {
  it("150 inscriptions, badges, produits, retrait, envoi, journal et notification du staff", async () => {
    const stamp = `${Date.now()}`;
    await prisma.user.createMany({
      data: Array.from({ length: 150 }, (_, i) => ({ email: `bulk-${stamp}-${i}@x.test`, password: "x", name: `P${i}` })),
    });
    const users = await prisma.user.findMany({ where: { email: { startsWith: `bulk-${stamp}-` } }, select: { id: true } });
    await prisma.registration.createMany({
      data: users.map((u, i) => ({
        id: `BULK-${stamp}-${i}`,
        userId: u.id,
        eventId: fx.event.id,
        categoryId: fx.categories[0].id,
        status: "APPROVED" as const,
        snapshotFirstName: "Prenom",
        snapshotLastName: `Nom${String(i).padStart(3, "0")}`,
        snapshotEmail: `bulk-${stamp}-${i}@r.test`,
        snapshotStructure: "S",
        snapshotPhoto: "",
        snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: "1",
        snapshotIdDocument: "",
      })) as never,
    });

    const created = await call(list.POST as Handler, "POST", { body: { type: "ADVANCE" } });
    expect(created.status).toBe(201);
    const { request } = await created.json();

    const sel = await call(badges.PUT as Handler, "PUT", { requestId: request.id, body: { selection: { mode: "ALL_AVAILABLE" } } });
    expect(sel.status).toBe(200);
    expect((await sel.json()).count).toBe(153);

    const prod = await call(products.PUT as Handler, "PUT", {
      requestId: request.id,
      body: {
        products: [
          { productId: fx.badgeProduct.id, quantity: null, choices: [] },
          { productId: fx.lanyard.id, quantity: 153, choices: [] },
        ],
      },
    });
    expect(prod.status).toBe(200);
    expect((await prod.json()).total).toBe(153 * 1500 + 153 * 500);

    const det = await call(detail.PATCH as Handler, "PATCH", { requestId: request.id, body: { delivery: "PICKUP" } });
    expect(det.status).toBe(200);

    const sent = await call(submit.POST as Handler, "POST", { requestId: request.id });
    expect(sent.status).toBe(200);
    expect((await sent.json()).request.status).toBe("SUBMITTED");
    expect(await logs("PRINT_REQUEST_SUBMITTED")).toHaveLength(1);
    expect(await prisma.notification.count({ where: { type: "PRINT_REQUEST_SUBMITTED", userId: fx.staffAdmin.id } })).toBe(1);
  });
});
