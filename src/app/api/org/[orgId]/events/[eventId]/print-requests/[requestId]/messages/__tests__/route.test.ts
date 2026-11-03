import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedPrintFixture, makeRequest, type PrintFixture } from "@/lib/__tests__/helpers/print-requests";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
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
import { GET, POST } from "@/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/messages/route";

type User = { id: string; email: string; name: string };

let fx: PrintFixture;

function login(user: User, isStaff = false) {
  vi.mocked(getServerSession).mockResolvedValue(
    { user: { id: user.id, email: user.email, name: user.name, isStaff } } as never,
  );
}

function call(method: "GET" | "POST", requestId: string, opts: { query?: string; body?: unknown } = {}) {
  const orgId = fx.org.id;
  const eventId = fx.event.id;
  const url = `http://localhost/api/org/${orgId}/events/${eventId}/print-requests/${requestId}/messages${opts.query ?? ""}`;
  const req = new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return (method === "GET" ? GET : POST)(req, { params: Promise.resolve({ orgId, eventId, requestId }) } as never);
}

const staffMessage = (requestId: string, data: Record<string, unknown> = {}) =>
  prisma.printRequestMessage.create({
    data: { requestId, side: "STAFF", kind: "MESSAGE", body: "Bonjour", authorId: fx.staffAdmin.id, ...data },
  });

const lastRead = (requestId: string, userId: string) =>
  prisma.printRequestRead.findUnique({ where: { requestId_userId: { requestId, userId } } });

beforeEach(async () => {
  vi.mocked(getServerSession).mockReset();
  fx = await seedPrintFixture();
  login(fx.eventAdmin);
});

describe("GET messages (organisateur)", () => {
  it("renvoie le fil sans note interne et enregistre la lecture", async () => {
    const r = await makeRequest(fx, { status: "SUBMITTED" });
    await staffMessage(r.id, { body: "visible" });
    await staffMessage(r.id, { body: "secret", internal: true });
    const before = new Date();
    const res = await call("GET", r.id);
    expect(res.status).toBe(200);
    const { entries } = await res.json();
    expect(entries.map((e: { body: string }) => e.body)).toEqual(["visible"]);
    const read = await lastRead(r.id, fx.eventAdmin.id);
    expect(read!.lastReadAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
  });

  it("?after ne renvoie que les entrées strictement postérieures", async () => {
    const r = await makeRequest(fx, { status: "SUBMITTED" });
    const first = await staffMessage(r.id, { body: "un", createdAt: new Date("2026-01-01T10:00:00Z") });
    await staffMessage(r.id, { body: "deux", createdAt: new Date("2026-01-01T10:00:05Z") });
    const { entries } = await (await call("GET", r.id, { query: `?after=${first.createdAt.toISOString()}` })).json();
    expect(entries.map((e: { body: string }) => e.body)).toEqual(["deux"]);
  });

  it("?after invalide : 400 VALIDATION, aucune lecture enregistrée", async () => {
    const r = await makeRequest(fx, { status: "SUBMITTED" });
    const res = await call("GET", r.id, { query: "?after=pas-une-date" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("VALIDATION");
    expect(await lastRead(r.id, fx.eventAdmin.id)).toBeNull();
  });

  it("le staff en consultation n'enregistre pas de lecture", async () => {
    const r = await makeRequest(fx, { status: "SUBMITTED" });
    login(fx.staffAdmin, true);
    expect((await call("GET", r.id)).status).toBe(200);
    expect(await lastRead(r.id, fx.staffAdmin.id)).toBeNull();
  });
});

describe("POST message (organisateur)", () => {
  it("refuse le drapeau internal : 400 VALIDATION, aucune entrée créée", async () => {
    const r = await makeRequest(fx, { status: "SUBMITTED" });
    const res = await call("POST", r.id, { body: { body: "note", internal: true } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("VALIDATION");
    expect(await prisma.printRequestMessage.count({ where: { requestId: r.id } })).toBe(0);
  });
});
