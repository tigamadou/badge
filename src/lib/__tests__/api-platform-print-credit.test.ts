import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedPrintFixture, makeRequest, type PrintFixture } from "./helpers/print-requests";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { POST } from "@/app/api/platform/print/requests/[requestId]/credit/route";

type User = { id: string; email: string; name: string };
let fx: PrintFixture;

function as(user: User | null) {
  vi.mocked(getServerSession).mockResolvedValue(
    (user ? { user: { id: user.id, email: user.email, name: user.name, isStaff: true } } : null) as never,
  );
}

async function post(requestId: string, body?: unknown, raw?: string) {
  const req = new NextRequest(`http://localhost/api/platform/print/requests/${requestId}/credit`, {
    method: "POST",
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    headers: { "content-type": "application/json" },
  });
  const res = await POST(req, { params: Promise.resolve({ requestId }) });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

async function requestOf(status: "SUBMITTED" | "QUOTED" | "DRAFT" = "SUBMITTED") {
  const r = await makeRequest(fx, { status, total: 60000, quoteVersion: status === "QUOTED" ? 1 : 0 });
  await prisma.printQuoteLine.create({
    data: {
      requestId: r.id, kind: "SERVICE", label: "Impression", quantity: 1, unitPrice: 60000,
      lineTotal: 60000, position: 0, addedBy: "STAFF",
    },
  });
  return r;
}

beforeEach(async () => {
  vi.mocked(getServerSession).mockReset();
  fx = await seedPrintFixture();
  as(fx.staffAdmin);
  await prisma.orgPrintCredit.create({ data: { orgId: fx.org.id, kind: "EARNED", amount: 45000 } });
});

describe("POST /api/platform/print/requests/[requestId]/credit", () => {
  it("401 sans session, 403 non-staff et STAFF_SUPPORT / STAFF_OBSERVER", async () => {
    const r = await requestOf();
    as(null);
    expect((await post(r.id, { amount: 1000 })).status).toBe(401);
    for (const user of [fx.owner, fx.staffSupport, fx.staffObserver]) {
      as(user);
      expect((await post(r.id, { amount: 1000 })).status).toBe(403);
    }
    expect(await prisma.printQuoteLine.count({ where: { requestId: r.id, usesOrgCredit: true } })).toBe(0);
  });

  it("400 : montant 0, négatif, décimal, absent, corps invalide", async () => {
    const r = await requestOf();
    for (const body of [{ amount: 0 }, { amount: -5 }, { amount: 1.5 }, { amount: "10" }, {}, { amount: 3_000_000_000 }]) {
      expect((await post(r.id, body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await post(r.id, undefined, "{pas du json")).status).toBe(400);
  });

  it("201 { line, available } et journal PRINT_CREDIT_APPLIED", async () => {
    const r = await requestOf();
    const { status, json } = await post(r.id, { amount: 20000 });
    expect(status).toBe(201);
    expect(json.line).toMatchObject({ kind: "DISCOUNT", unitPrice: -20000, lineTotal: -20000, addedBy: "STAFF" });
    expect(json.available).toBe(25000);
    const logs = await prisma.activityLog.findMany({ where: { targetId: r.id, type: "PRINT_CREDIT_APPLIED" } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ userId: fx.staffAdmin.id, orgId: fx.org.id, eventId: fx.event.id });
    expect(logs[0].details).toEqual({ amount: 20000 });
  });

  it("demande QUOTED : repasse SUBMITTED et prévient l'organisateur", async () => {
    const r = await requestOf("QUOTED");
    expect((await post(r.id, { amount: 1000 })).status).toBe(201);
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("SUBMITTED");
    const rows = await prisma.notification.findMany({ where: { type: "PRINT_REQUEST_STATUS_CHANGED", userId: fx.manager.id } });
    expect(rows.length).toBeGreaterThan(0);
  });

  it("409 CREDIT_INSUFFICIENT et CREDIT_EXCEEDS_TOTAL, 404 inconnue ou brouillon", async () => {
    const r = await requestOf();
    const insufficient = await post(r.id, { amount: 45001 });
    expect(insufficient).toMatchObject({ status: 409, json: { error: "CREDIT_INSUFFICIENT", available: 45000 } });
    await prisma.orgPrintCredit.create({ data: { orgId: fx.org.id, kind: "EARNED", amount: 100000 } });
    expect(await post(r.id, { amount: 60001 })).toMatchObject({ status: 409, json: { error: "CREDIT_EXCEEDS_TOTAL" } });
    expect((await post("inconnue", { amount: 1 })).status).toBe(404);
    expect((await post((await requestOf("DRAFT")).id, { amount: 1 })).status).toBe(404);
    expect(await prisma.activityLog.count({ where: { targetId: r.id, type: "PRINT_CREDIT_APPLIED" } })).toBe(0);
  });
});
