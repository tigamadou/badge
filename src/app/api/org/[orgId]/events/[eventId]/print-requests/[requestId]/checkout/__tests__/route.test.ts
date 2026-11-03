import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedAcceptedPrintRequest, makeRequest } from "@/lib/__tests__/helpers/print-requests";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
// Passe-plat sur le vrai checkout, pour pouvoir simuler une erreur inattendue.
vi.mock("@/lib/payments", async (orig) => {
  const actual = await orig<typeof import("@/lib/payments")>();
  return { ...actual, startPrintRequestCheckout: vi.fn(actual.startPrintRequestCheckout) };
});
// L'abonnement est géré ailleurs : l'organisation est considérée active.
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
import { getServerSession } from "next-auth";
import { startPrintRequestCheckout } from "@/lib/payments";
import { POST } from "@/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/checkout/route";

type User = { id: string; email: string; name: string };
type Fx = Awaited<ReturnType<typeof seedAcceptedPrintRequest>>;

function login(user: User | null, isStaff = false) {
  vi.mocked(getServerSession).mockResolvedValue(
    user ? ({ user: { id: user.id, email: user.email, name: user.name, isStaff } } as never) : null,
  );
}

function call(fx: Fx, opts: { requestId?: string; eventId?: string; orgId?: string } = {}) {
  const orgId = opts.orgId ?? fx.org.id;
  const eventId = opts.eventId ?? fx.event.id;
  const requestId = opts.requestId ?? fx.request.id;
  const req = new NextRequest(`http://localhost/api/org/${orgId}/events/${eventId}/print-requests/${requestId}/checkout`, {
    method: "POST",
  });
  return POST(req, { params: Promise.resolve({ orgId, eventId, requestId }) });
}

function stubFedapay() {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ "v1/transaction": { id: 5, reference: "r", amount: 5000, status: "pending" } })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ "v1/token": { url: "https://pay.fedapay.com/t" } }))),
  );
}

describe("POST /api/org/[orgId]/events/[eventId]/print-requests/[requestId]/checkout", () => {
  let fx: Fx;
  beforeEach(async () => {
    vi.mocked(getServerSession).mockReset();
    vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_test");
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "whsec");
    process.env.NEXTAUTH_URL = "https://badge.local";
    fx = await seedAcceptedPrintRequest();
    login(fx.owner);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("401 sans session", async () => {
    login(null);
    expect((await call(fx)).status).toBe(401);
  });

  it("403 STAFF_FORBIDDEN pour un STAFF_ADMIN", async () => {
    login(fx.staffAdmin, true);
    const res = await call(fx);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("STAFF_FORBIDDEN");
  });

  it("403 OWNER_REQUIRED pour le MANAGER", async () => {
    login(fx.manager);
    const res = await call(fx);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("OWNER_REQUIRED");
  });

  it("403 pour un membre VIEWER de l'évènement", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const viewer = await prisma.user.create({ data: { email: `v-${stamp}@x.test`, password: "x", name: "V" } });
    await prisma.eventMembership.create({ data: { userId: viewer.id, eventId: fx.event.id, role: "VIEWER" } });
    login(viewer);
    expect((await call(fx)).status).toBe(403);
  });

  it("404 pour un évènement d'une autre organisation", async () => {
    const other = await seedAcceptedPrintRequest();
    expect((await call(fx, { eventId: other.event.id })).status).toBe(404);
  });

  it("200 { url } pour l'OWNER", async () => {
    stubFedapay();
    const res = await call(fx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://pay.fedapay.com/t" });
  });

  it("200 { url } même si l'évènement est archivé (abonnement actif)", async () => {
    await prisma.event.update({ where: { id: fx.event.id }, data: { archived: true, archivedAt: new Date() } });
    stubFedapay();
    const res = await call(fx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://pay.fedapay.com/t" });
  });

  it("404 REQUEST_NOT_FOUND pour une commande inconnue", async () => {
    const res = await call(fx, { requestId: "inconnue" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "REQUEST_NOT_FOUND" });
  });

  it("409 REQUEST_NOT_PAYABLE sur une commande QUOTED", async () => {
    const quoted = await makeRequest(fx, { status: "QUOTED", quoteVersion: 1, total: 5000 });
    const res = await call(fx, { requestId: quoted.id });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "REQUEST_NOT_PAYABLE" });
  });

  it("503 PAYMENTS_DISABLED sans configuration FedaPay", async () => {
    vi.stubEnv("FEDAPAY_SECRET_KEY", "");
    const res = await call(fx);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "PAYMENTS_DISABLED" });
  });

  it("erreur inattendue → propagée", async () => {
    vi.mocked(startPrintRequestCheckout).mockRejectedValueOnce(new Error("boom"));
    await expect(call(fx)).rejects.toThrow("boom");
  });
});
