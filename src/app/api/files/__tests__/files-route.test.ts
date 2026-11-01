import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/storage", () => ({
  getFile: vi.fn(async () => ({ body: Buffer.from("zip"), contentType: "application/zip" })),
}));
import { getServerSession } from "next-auth";

import { GET } from "../[...path]/route";

const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function setup() {
  const org = await prisma.organization.create({ data: { name: "O", slug: uniq("o") } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: uniq("e"), location: "L", date: new Date() },
  });
  return { org, event };
}

async function login(opts: { eventId?: string; role?: "PRINTER" | "VIEWER"; staff?: boolean }) {
  const u = await prisma.user.create({
    data: {
      email: `${uniq("u")}@x`,
      password: "x",
      name: "U",
      ...(opts.staff ? { isStaff: true, staffRole: "STAFF_SUPPORT" as const } : {}),
    },
  });
  if (opts.eventId && opts.role) {
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: opts.eventId, role: opts.role } });
  }
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: u.id, email: u.email, name: u.name, isStaff: !!opts.staff },
  } as never);
}

const read = (key: string) =>
  GET(new NextRequest(`http://localhost/api/files/${key}`), { params: Promise.resolve({ path: key.split("/") }) });

describe("GET /api/files/badge-exports/{eventId}/...", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("un PRINTER de l'evenement lit l'archive, sans cache", async () => {
    const { event } = await setup();
    await login({ eventId: event.id, role: "PRINTER" });
    const res = await read(`badge-exports/${event.id}/abc.zip`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("un PRINTER d'un autre evenement recoit 403", async () => {
    const mine = await setup();
    const other = await setup();
    await login({ eventId: other.event.id, role: "PRINTER" });
    expect((await read(`badge-exports/${mine.event.id}/abc.zip`)).status).toBe(403);
  });

  it("un VIEWER, un anonyme et un evenement inconnu recoivent 403", async () => {
    const { event } = await setup();
    await login({ eventId: event.id, role: "VIEWER" });
    expect((await read(`badge-exports/${event.id}/abc.zip`)).status).toBe(403);
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await read(`badge-exports/${event.id}/abc.zip`)).status).toBe(403);
    await login({ staff: false });
    expect((await read(`badge-exports/inconnu/abc.zip`)).status).toBe(403);
  });

  it("le staff lit n'importe quelle archive", async () => {
    const { event } = await setup();
    await login({ staff: true });
    expect((await read(`badge-exports/${event.id}/abc.zip`)).status).toBe(200);
  });
});

async function loginStaff(role: "STAFF_OBSERVER" | "STAFF_SUPPORT") {
  const u = await prisma.user.create({
    data: { email: `${uniq("st")}@x`, password: "x", name: "S", isStaff: true, staffRole: role },
  });
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: u.id, email: u.email, name: u.name, isStaff: true },
  } as never);
}

describe("GET /api/files/print-requests/... et platform/print-products/...", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("print-requests/ : 403 sans session et pour un non-staff", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await read("print-requests/staff/x.pdf")).status).toBe(403);
    await login({ staff: false });
    expect((await read("print-requests/staff/x.pdf")).status).toBe(403);
  });

  it("print-requests/ : 200 private no-store pour tout staff, STAFF_OBSERVER compris", async () => {
    await loginStaff("STAFF_OBSERVER");
    const res = await read("print-requests/staff/x.pdf");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("platform/print-products/ reste public", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const res = await read("platform/print-products/x.jpg");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
  });

  it("refuse toute cle contenant un segment .. (404, sans lecture du stockage)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { getFile } = await import("@/lib/storage");
    vi.mocked(getFile).mockClear();
    const res = await GET(new NextRequest("http://localhost/api/files/x"), {
      params: Promise.resolve({ path: ["platform", "print-products", "..", "..", "profile", "u1", "documents", "id.pdf"] }),
    });
    expect(res.status).toBe(404);
    expect(getFile).not.toHaveBeenCalled();
  });
});
