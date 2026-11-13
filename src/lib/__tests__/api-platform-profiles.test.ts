import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

vi.mock("@/lib/mail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mail")>();
  return {
    ...actual,
    sendProfileApproved: vi.fn().mockResolvedValue(undefined),
    sendProfileRejected: vi.fn().mockResolvedValue(undefined),
  };
});
import { sendProfileApproved, sendProfileRejected } from "@/lib/mail";
import { makeStaff } from "@/test/factories";

async function asStaff(role: "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_OBSERVER" = "STAFF_SUPPORT") {
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

const PIECES = {
  photo: "profile/u/photos/p.png",
  idDocumentType: "CNI",
  idDocumentNumber: "AB-1",
  idDocument: "profile/u/documents/d.pdf",
};

async function createParticipant(status: "PENDING" | "APPROVED" | "REJECTED", extra: Record<string, unknown> = {}) {
  const user = await prisma.user.create({
    data: {
      email: `part-${Date.now()}-${Math.random()}@x`,
      password: "x",
      name: "Part",
      firstName: "Awa",
      lastName: "Diallo",
      structure: "ACME",
      ...PIECES,
      profileStatus: status,
      ...extra,
    },
  });
  await prisma.profileSubmission.create({
    data: { userId: user.id, ...PIECES, status: status === "APPROVED" ? "APPROVED" : "PENDING" },
  });
  return user;
}

async function createReason(scope: "PROFILE" | "REGISTRATION" | "BOTH", label = "Piece illisible") {
  return prisma.rejectionReason.create({ data: { label, scope } });
}

describe("Platform profiles moderation API", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
    vi.mocked(sendProfileApproved).mockClear();
    vi.mocked(sendProfileRejected).mockClear();
  });

  it("GET liste sans session -> 401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { GET } = await import("@/app/api/platform/profiles/route");
    const res = await GET(req("/api/platform/profiles", "GET"), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("GET liste en STAFF_OBSERVER renvoie les profils PENDING par defaut", async () => {
    await createParticipant("PENDING");
    await createParticipant("APPROVED");
    await asStaff("STAFF_OBSERVER");
    const { GET } = await import("@/app/api/platform/profiles/route");
    const res = await GET(req("/api/platform/profiles", "GET"), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const { users } = await res.json();
    expect(users).toHaveLength(1);
    expect(users[0].profileStatus).toBe("PENDING");
  });

  it("GET ?status invalide -> 400", async () => {
    await asStaff("STAFF_OBSERVER");
    const { GET } = await import("@/app/api/platform/profiles/route");
    const res = await GET(req("/api/platform/profiles?status=NOPE", "GET"), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it("GET ?q filtre sur nom/email/numero", async () => {
    const target = await createParticipant("PENDING", { firstName: "Zoe", email: `zoe-${Date.now()}@x` });
    await createParticipant("PENDING", { firstName: "Bob" });
    await asStaff("STAFF_OBSERVER");
    const { GET } = await import("@/app/api/platform/profiles/route");
    const res = await GET(req("/api/platform/profiles?q=Zoe", "GET"), { params: Promise.resolve({}) });
    const { users } = await res.json();
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe(target.id);
  });

  it("GET detail renvoie profil + historique trie", async () => {
    const user = await createParticipant("PENDING");
    await asStaff("STAFF_OBSERVER");
    const { GET } = await import("@/app/api/platform/profiles/[userId]/route");
    const res = await GET(req(`/api/platform/profiles/${user.id}`, "GET"), { params: Promise.resolve({ userId: user.id }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.id).toBe(user.id);
    expect(json.submissions.length).toBeGreaterThanOrEqual(1);
  });

  it("GET detail id inconnu -> 404", async () => {
    await asStaff("STAFF_OBSERVER");
    const { GET } = await import("@/app/api/platform/profiles/[userId]/route");
    const res = await GET(req("/api/platform/profiles/missing", "GET"), { params: Promise.resolve({ userId: "missing" }) });
    expect(res.status).toBe(404);
  });

  it("POST approve en STAFF_OBSERVER -> 403", async () => {
    const user = await createParticipant("PENDING");
    await asStaff("STAFF_OBSERVER");
    const { POST } = await import("@/app/api/platform/profiles/[userId]/approve/route");
    const res = await POST(req(`/api/platform/profiles/${user.id}/approve`, "POST"), { params: Promise.resolve({ userId: user.id }) });
    expect(res.status).toBe(403);
  });

  it("POST approve en STAFF_SUPPORT approuve, logue et notifie", async () => {
    const user = await createParticipant("PENDING");
    const staff = await asStaff("STAFF_SUPPORT");
    const { POST } = await import("@/app/api/platform/profiles/[userId]/approve/route");
    const res = await POST(req(`/api/platform/profiles/${user.id}/approve`, "POST"), { params: Promise.resolve({ userId: user.id }) });
    expect(res.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.profileStatus).toBe("APPROVED");
    expect(await prisma.activityLog.findFirst({ where: { type: "PROFILE_APPROVED", userId: staff.id, targetId: user.id } })).not.toBeNull();
    expect(sendProfileApproved).toHaveBeenCalledWith(user.id);
  });

  it("POST approve renvoie 200 meme si la notification echoue", async () => {
    const user = await createParticipant("PENDING");
    await asStaff("STAFF_SUPPORT");
    vi.mocked(sendProfileApproved).mockRejectedValueOnce(new Error("smtp down"));
    const { POST } = await import("@/app/api/platform/profiles/[userId]/approve/route");
    const res = await POST(req(`/api/platform/profiles/${user.id}/approve`, "POST"), { params: Promise.resolve({ userId: user.id }) });
    expect(res.status).toBe(200);
  });

  it("POST approve propage une erreur inattendue", async () => {
    const user = await createParticipant("PENDING");
    await asStaff("STAFF_SUPPORT");
    const spy = vi.spyOn(prisma.profileSubmission, "update").mockRejectedValueOnce(new Error("boom-approve"));
    const { POST } = await import("@/app/api/platform/profiles/[userId]/approve/route");
    await expect(
      POST(req(`/api/platform/profiles/${user.id}/approve`, "POST"), { params: Promise.resolve({ userId: user.id }) }),
    ).rejects.toThrow("boom-approve");
    spy.mockRestore();
  });

  it("POST reject renvoie 200 meme si la notification echoue", async () => {
    const user = await createParticipant("PENDING");
    const reason = await createReason("PROFILE");
    await asStaff("STAFF_SUPPORT");
    vi.mocked(sendProfileRejected).mockRejectedValueOnce(new Error("smtp down"));
    const { POST } = await import("@/app/api/platform/profiles/[userId]/reject/route");
    const res = await POST(
      req(`/api/platform/profiles/${user.id}/reject`, "POST", { reasonId: reason.id }),
      { params: Promise.resolve({ userId: user.id }) },
    );
    expect(res.status).toBe(200);
  });

  it("POST reject propage une erreur inattendue", async () => {
    const user = await createParticipant("PENDING");
    const reason = await createReason("PROFILE");
    await asStaff("STAFF_SUPPORT");
    const spy = vi.spyOn(prisma.profileSubmission, "update").mockRejectedValueOnce(new Error("boom-reject"));
    const { POST } = await import("@/app/api/platform/profiles/[userId]/reject/route");
    await expect(
      POST(req(`/api/platform/profiles/${user.id}/reject`, "POST", { reasonId: reason.id }), {
        params: Promise.resolve({ userId: user.id }),
      }),
    ).rejects.toThrow("boom-reject");
    spy.mockRestore();
  });

  it("POST approve sans soumission en attente -> 409", async () => {
    const user = await createParticipant("APPROVED");
    await asStaff("STAFF_SUPPORT");
    const { POST } = await import("@/app/api/platform/profiles/[userId]/approve/route");
    const res = await POST(req(`/api/platform/profiles/${user.id}/approve`, "POST"), { params: Promise.resolve({ userId: user.id }) });
    expect(res.status).toBe(409);
  });

  it("POST reject en STAFF_SUPPORT rejette avec motif PROFILE, logue et notifie", async () => {
    const user = await createParticipant("PENDING");
    const reason = await createReason("PROFILE", "Piece illisible");
    const staff = await asStaff("STAFF_SUPPORT");
    const { POST } = await import("@/app/api/platform/profiles/[userId]/reject/route");
    const res = await POST(
      req(`/api/platform/profiles/${user.id}/reject`, "POST", { reasonId: reason.id, details: "flou" }),
      { params: Promise.resolve({ userId: user.id }) },
    );
    expect(res.status).toBe(200);
    const sub = await prisma.profileSubmission.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
    expect(sub?.status).toBe("REJECTED");
    expect(sub?.rejectionReasonLabel).toBe("Piece illisible");
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.profileStatus).toBe("REJECTED");
    expect(await prisma.activityLog.findFirst({ where: { type: "PROFILE_REJECTED", userId: staff.id } })).not.toBeNull();
    expect(sendProfileRejected).toHaveBeenCalledWith(user.id);
  });

  it("POST reject avec motif REGISTRATION -> 400 REASON_WRONG_SCOPE", async () => {
    const user = await createParticipant("PENDING");
    const reason = await createReason("REGISTRATION", "Quota atteint");
    await asStaff("STAFF_SUPPORT");
    const { POST } = await import("@/app/api/platform/profiles/[userId]/reject/route");
    const res = await POST(
      req(`/api/platform/profiles/${user.id}/reject`, "POST", { reasonId: reason.id }),
      { params: Promise.resolve({ userId: user.id }) },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("REASON_WRONG_SCOPE");
  });

  it("POST reject sans reasonId -> 400 VALIDATION", async () => {
    const user = await createParticipant("PENDING");
    await asStaff("STAFF_SUPPORT");
    const { POST } = await import("@/app/api/platform/profiles/[userId]/reject/route");
    const res = await POST(req(`/api/platform/profiles/${user.id}/reject`, "POST", {}), { params: Promise.resolve({ userId: user.id }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("VALIDATION");
  });

  it("POST reject corps JSON malforme -> 400 VALIDATION", async () => {
    const user = await createParticipant("PENDING");
    await asStaff("STAFF_SUPPORT");
    const { POST } = await import("@/app/api/platform/profiles/[userId]/reject/route");
    const raw = new NextRequest(`http://localhost/api/platform/profiles/${user.id}/reject`, {
      method: "POST",
      body: "{bad",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(raw, { params: Promise.resolve({ userId: user.id }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("VALIDATION");
  });

  it("POST reject motif inconnu -> 400 REASON_NOT_FOUND", async () => {
    const user = await createParticipant("PENDING");
    await asStaff("STAFF_SUPPORT");
    const { POST } = await import("@/app/api/platform/profiles/[userId]/reject/route");
    const res = await POST(
      req(`/api/platform/profiles/${user.id}/reject`, "POST", { reasonId: "missing" }),
      { params: Promise.resolve({ userId: user.id }) },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("REASON_NOT_FOUND");
  });
});
