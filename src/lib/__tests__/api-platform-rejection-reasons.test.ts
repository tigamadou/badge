import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { makeStaff } from "@/test/factories";

async function asStaff(role: "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_OBSERVER" = "STAFF_ADMIN") {
  const u = await makeStaff(role);
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: u.id, email: u.email, name: u.name, isStaff: true },
  } as never);
  return u;
}

function req(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function rawReq(url: string, method: string, raw: string) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    body: raw,
    headers: { "content-type": "application/json" },
  });
}

async function seedReason(label: string, scope: "PROFILE" | "REGISTRATION" | "BOTH", extra: Record<string, unknown> = {}) {
  return prisma.rejectionReason.create({ data: { label, scope, ...extra } });
}

describe("Rejection reasons platform API", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("GET sans session -> 401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { GET } = await import("@/app/api/platform/rejection-reasons/route");
    const res = await GET(req("/api/platform/rejection-reasons", "GET"), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("STAFF_OBSERVER liste, triee par sortOrder", async () => {
    await asStaff("STAFF_OBSERVER");
    await seedReason("B", "PROFILE", { sortOrder: 20 });
    await seedReason("A", "PROFILE", { sortOrder: 10 });
    const { GET } = await import("@/app/api/platform/rejection-reasons/route");
    const res = await GET(req("/api/platform/rejection-reasons", "GET"), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const { reasons } = await res.json();
    expect(reasons.map((r: { label: string }) => r.label)).toEqual(["A", "B"]);
  });

  it("GET ?scope=PROFILE renvoie PROFILE et BOTH", async () => {
    await asStaff("STAFF_OBSERVER");
    await seedReason("prof", "PROFILE");
    await seedReason("both", "BOTH");
    await seedReason("reg", "REGISTRATION");
    const { GET } = await import("@/app/api/platform/rejection-reasons/route");
    const res = await GET(req("/api/platform/rejection-reasons?scope=PROFILE", "GET"), { params: Promise.resolve({}) });
    const { reasons } = await res.json();
    expect(reasons.map((r: { label: string }) => r.label).sort()).toEqual(["both", "prof"]);
  });

  it("GET ?scope=REGISTRATION renvoie REGISTRATION et BOTH", async () => {
    await asStaff("STAFF_OBSERVER");
    await seedReason("prof", "PROFILE");
    await seedReason("both", "BOTH");
    await seedReason("reg", "REGISTRATION");
    const { GET } = await import("@/app/api/platform/rejection-reasons/route");
    const res = await GET(req("/api/platform/rejection-reasons?scope=REGISTRATION", "GET"), { params: Promise.resolve({}) });
    const { reasons } = await res.json();
    expect(reasons.map((r: { label: string }) => r.label).sort()).toEqual(["both", "reg"]);
  });

  it("GET par defaut exclut les archives ; ?archived=true ne renvoie qu'eux", async () => {
    await asStaff("STAFF_OBSERVER");
    await seedReason("actif", "PROFILE");
    await seedReason("archive", "PROFILE", { archived: true, archivedAt: new Date() });
    const { GET } = await import("@/app/api/platform/rejection-reasons/route");
    const active = await (await GET(req("/api/platform/rejection-reasons", "GET"), { params: Promise.resolve({}) })).json();
    expect(active.reasons.map((r: { label: string }) => r.label)).toEqual(["actif"]);
    const archived = await (await GET(req("/api/platform/rejection-reasons?archived=true", "GET"), { params: Promise.resolve({}) })).json();
    expect(archived.reasons.map((r: { label: string }) => r.label)).toEqual(["archive"]);
  });

  it("STAFF_SUPPORT ne peut pas creer (403)", async () => {
    await asStaff("STAFF_SUPPORT");
    const { POST } = await import("@/app/api/platform/rejection-reasons/route");
    const res = await POST(req("/api/platform/rejection-reasons", "POST", { label: "x", scope: "PROFILE" }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(403);
  });

  it("STAFF_ADMIN cree un motif et logue REJECTION_REASON_CREATED", async () => {
    const staff = await asStaff("STAFF_ADMIN");
    const { POST } = await import("@/app/api/platform/rejection-reasons/route");
    const res = await POST(
      req("/api/platform/rejection-reasons", "POST", { label: "Photo floue", scope: "PROFILE", sortOrder: 5 }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(201);
    const { reason } = await res.json();
    expect(reason.label).toBe("Photo floue");
    const log = await prisma.activityLog.findFirst({ where: { type: "REJECTION_REASON_CREATED", targetId: reason.id } });
    expect(log?.userId).toBe(staff.id);
  });

  it("STAFF_ADMIN cree un motif sans sortOrder (defaut 0)", async () => {
    await asStaff("STAFF_ADMIN");
    const { POST } = await import("@/app/api/platform/rejection-reasons/route");
    const res = await POST(req("/api/platform/rejection-reasons", "POST", { label: "Sans ordre", scope: "BOTH" }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(201);
    const { reason } = await res.json();
    expect(reason.sortOrder).toBe(0);
  });

  it("PATCH corps invalide -> 400", async () => {
    await asStaff("STAFF_ADMIN");
    const reason = await seedReason("patch-invalid", "PROFILE");
    const { PATCH } = await import("@/app/api/platform/rejection-reasons/[id]/route");
    const res = await PATCH(req(`/api/platform/rejection-reasons/${reason.id}`, "PATCH", { scope: "NOPE" }), {
      params: Promise.resolve({ id: reason.id }),
    });
    expect(res.status).toBe(400);
  });

  it("POST corps invalide -> 400", async () => {
    await asStaff("STAFF_ADMIN");
    const { POST } = await import("@/app/api/platform/rejection-reasons/route");
    const res = await POST(req("/api/platform/rejection-reasons", "POST", { label: "", scope: "NOPE" }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(400);
  });

  it("PATCH met a jour et logue REJECTION_REASON_UPDATED", async () => {
    const staff = await asStaff("STAFF_ADMIN");
    const reason = await seedReason("ancien", "PROFILE");
    const { PATCH } = await import("@/app/api/platform/rejection-reasons/[id]/route");
    const res = await PATCH(req(`/api/platform/rejection-reasons/${reason.id}`, "PATCH", { label: "nouveau", sortOrder: 3 }), {
      params: Promise.resolve({ id: reason.id }),
    });
    expect(res.status).toBe(200);
    const updated = await prisma.rejectionReason.findUnique({ where: { id: reason.id } });
    expect(updated?.label).toBe("nouveau");
    const log = await prisma.activityLog.findFirst({ where: { type: "REJECTION_REASON_UPDATED", targetId: reason.id } });
    expect(log?.userId).toBe(staff.id);
  });

  it("POST corps JSON malforme -> 400", async () => {
    await asStaff("STAFF_ADMIN");
    const { POST } = await import("@/app/api/platform/rejection-reasons/route");
    const res = await POST(rawReq("/api/platform/rejection-reasons", "POST", "{not-json"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(400);
  });

  it("PATCH corps JSON malforme -> 400", async () => {
    await asStaff("STAFF_ADMIN");
    const reason = await seedReason("patch-raw", "PROFILE");
    const { PATCH } = await import("@/app/api/platform/rejection-reasons/[id]/route");
    const res = await PATCH(rawReq(`/api/platform/rejection-reasons/${reason.id}`, "PATCH", "{bad"), {
      params: Promise.resolve({ id: reason.id }),
    });
    expect(res.status).toBe(400);
  });

  it("PATCH id inconnu -> 404", async () => {
    await asStaff("STAFF_ADMIN");
    const { PATCH } = await import("@/app/api/platform/rejection-reasons/[id]/route");
    const res = await PATCH(req("/api/platform/rejection-reasons/missing", "PATCH", { label: "x" }), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(res.status).toBe(404);
  });

  it("DELETE archive (soft delete) et preserve l'historique", async () => {
    const staff = await asStaff("STAFF_ADMIN");
    const reason = await seedReason("a-archiver", "PROFILE");
    const user = await prisma.user.create({ data: { email: `u-${Date.now()}@x`, password: "x", name: "U" } });
    await prisma.profileSubmission.create({
      data: {
        userId: user.id,
        photo: "p",
        idDocumentType: "CNI",
        idDocumentNumber: "N",
        idDocument: "d",
        status: "REJECTED",
        rejectionReasonId: reason.id,
        rejectionReasonLabel: reason.label,
      },
    });
    const { DELETE } = await import("@/app/api/platform/rejection-reasons/[id]/route");
    const res = await DELETE(req(`/api/platform/rejection-reasons/${reason.id}`, "DELETE"), {
      params: Promise.resolve({ id: reason.id }),
    });
    expect(res.status).toBe(200);
    const stored = await prisma.rejectionReason.findUnique({ where: { id: reason.id } });
    expect(stored?.archived).toBe(true);
    expect(stored?.archivedAt).not.toBeNull();
    const sub = await prisma.profileSubmission.findFirst({ where: { rejectionReasonId: reason.id } });
    expect(sub?.rejectionReasonLabel).toBe("a-archiver");
    const log = await prisma.activityLog.findFirst({ where: { type: "REJECTION_REASON_ARCHIVED", targetId: reason.id } });
    expect(log?.userId).toBe(staff.id);
  });

  it("DELETE id inconnu -> 404", async () => {
    await asStaff("STAFF_ADMIN");
    const { DELETE } = await import("@/app/api/platform/rejection-reasons/[id]/route");
    const res = await DELETE(req("/api/platform/rejection-reasons/missing", "DELETE"), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(res.status).toBe(404);
  });
});
