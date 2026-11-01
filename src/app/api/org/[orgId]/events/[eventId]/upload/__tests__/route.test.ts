import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

// Les gardes d'abonnement sont couverts ailleurs : ici l'organisation est considérée active.
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

// v4 Task 5.4 : upload photo/piece d'identite par un ADMIN d'evenement (fonctionne meme
// event.registrationOpen=false, contrairement a /api/upload). Reserve au role ADMIN.

function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}
function noSession() {
  vi.mocked(getServerSession).mockResolvedValue(null as never);
}

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

async function seedEventWithMember(role: "ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER" = "ADMIN") {
  const s = stamp();
  const user = await prisma.user.create({ data: { email: `up-${s}@x.test`, password: "x", name: "U" } });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${s}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `evt-${s}`, location: "L", date: new Date("2026-10-01") },
  });
  await prisma.eventMembership.create({ data: { userId: user.id, eventId: event.id, role } });
  withSession({ id: user.id, email: user.email, name: user.name, isStaff: false });
  return { user, org, event };
}

function makeReq(
  orgId: string,
  eventId: string,
  kind: string | null,
  file?: { name: string; type: string; bytes: Buffer },
): NextRequest {
  const url =
    kind === null
      ? `http://localhost/api/org/${orgId}/events/${eventId}/upload`
      : `http://localhost/api/org/${orgId}/events/${eventId}/upload?kind=${kind}`;
  const fd = new FormData();
  if (file) {
    const ab = new ArrayBuffer(file.bytes.byteLength);
    new Uint8Array(ab).set(file.bytes);
    fd.append("file", new Blob([ab], { type: file.type }), file.name);
  }
  return new NextRequest(url, { method: "POST", body: fd });
}

describe("POST /api/org/[orgId]/events/[eventId]/upload", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 without session", async () => {
    const { org, event } = await seedEventWithMember();
    noSession();
    const { POST } = await import("../route");
    const req = makeReq(org.id, event.id, "photo", { name: "p.jpg", type: "image/jpeg", bytes: Buffer.from("x") });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for OPERATOR (below ADMIN)", async () => {
    const { org, event } = await seedEventWithMember("OPERATOR");
    const { POST } = await import("../route");
    const req = makeReq(org.id, event.id, "photo", { name: "p.jpg", type: "image/jpeg", bytes: Buffer.from("x") });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 BAD_KIND when kind is missing", async () => {
    const { org, event } = await seedEventWithMember();
    const { POST } = await import("../route");
    const req = makeReq(org.id, event.id, null, { name: "p.jpg", type: "image/jpeg", bytes: Buffer.from("x") });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("BAD_KIND");
  });

  it("returns 400 BAD_KIND when kind is invalid", async () => {
    const { org, event } = await seedEventWithMember();
    const { POST } = await import("../route");
    const req = makeReq(org.id, event.id, "bogus", { name: "p.jpg", type: "image/jpeg", bytes: Buffer.from("x") });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("BAD_KIND");
  });

  it("returns 400 NO_FILE when the form has no file field", async () => {
    const { org, event } = await seedEventWithMember();
    const { POST } = await import("../route");
    const req = makeReq(org.id, event.id, "photo");
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("NO_FILE");
  });

  it("returns 400 NO_FILE when the multipart body fails to parse (form parsing error)", async () => {
    // req.formData().catch(() => null) : un corps multipart incoherent (boundary annoncee
    // absente du corps) fait echouer le parsing natif -> form=null -> file=undefined -> NO_FILE.
    // Confirme hors-suite (script node standalone) : req.formData() leve bien un TypeError
    // "Failed to parse body as FormData." dans ce cas.
    const { org, event } = await seedEventWithMember();
    const { POST } = await import("../route");
    const req = new NextRequest(
      `http://localhost/api/org/${org.id}/events/${event.id}/upload?kind=photo`,
      {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=broken" },
        body: "not a valid multipart body at all",
      },
    );
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("NO_FILE");
  });

  it("returns 415 BAD_TYPE for a disallowed mime (photo)", async () => {
    const { org, event } = await seedEventWithMember();
    const { POST } = await import("../route");
    const req = makeReq(org.id, event.id, "photo", { name: "p.txt", type: "text/plain", bytes: Buffer.from("x") });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(415);
    const json = await res.json();
    expect(json.code).toBe("BAD_TYPE");
  });

  it("returns 413 TOO_LARGE for files over 5 Mo", async () => {
    const { org, event } = await seedEventWithMember();
    const { POST } = await import("../route");
    const big = Buffer.alloc(5 * 1024 * 1024 + 1);
    const req = makeReq(org.id, event.id, "photo", { name: "big.jpg", type: "image/jpeg", bytes: big });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.code).toBe("TOO_LARGE");
  });

  it("accepts a valid JPEG for kind=photo and returns an events/.../photos storage key", async () => {
    const { org, event } = await seedEventWithMember();
    const { POST } = await import("../route");
    const req = makeReq(org.id, event.id, "photo", { name: "p.jpg", type: "image/jpeg", bytes: Buffer.from("xxx") });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.storageKey).toMatch(new RegExp(`^events/${event.id}/photos/.+\\.jpg$`));
  });

  it("accepts a valid PDF for kind=document and returns an events/.../idDocuments storage key", async () => {
    const { org, event } = await seedEventWithMember();
    const { POST } = await import("../route");
    const req = makeReq(org.id, event.id, "document", {
      name: "d.pdf",
      type: "application/pdf",
      bytes: Buffer.from("%PDF"),
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.storageKey).toMatch(new RegExp(`^events/${event.id}/idDocuments/.+\\.pdf$`));
  });

  it("rejects a PDF when kind=photo", async () => {
    const { org, event } = await seedEventWithMember();
    const { POST } = await import("../route");
    const req = makeReq(org.id, event.id, "photo", {
      name: "d.pdf",
      type: "application/pdf",
      bytes: Buffer.from("%PDF"),
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(415);
  });
});
