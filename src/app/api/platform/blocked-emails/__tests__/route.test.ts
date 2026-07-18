import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

function noSession() {
  vi.mocked(getServerSession).mockResolvedValue(null as never);
}

async function asNonStaff() {
  const u = await prisma.user.create({
    data: { email: `nostaff-${stamp()}@x.test`, password: "x", name: "N", isStaff: false },
  });
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: u.id, email: u.email, name: u.name, isStaff: false },
  } as never);
  return u;
}

async function asStaff(role: "STAFF_OBSERVER" | "STAFF_SUPPORT" | "STAFF_ADMIN") {
  const u = await prisma.user.create({
    data: {
      email: `staff-${role}-${stamp()}@x.test`,
      password: "x",
      name: "S",
      isStaff: true,
      staffRole: role,
    },
  });
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

// withStaffAuth requires the { params } arg even for routes without dynamic segments.
const noParams = { params: Promise.resolve({}) };

describe("/api/platform/blocked-emails", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  describe("GET", () => {
    it("401 when not authenticated", async () => {
      noSession();
      const { GET } = await import("@/app/api/platform/blocked-emails/route");
      const res = await GET(req("/api/platform/blocked-emails", "GET"), noParams);
      expect(res.status).toBe(401);
    });

    it("403 when the user is not staff", async () => {
      await asNonStaff();
      const { GET } = await import("@/app/api/platform/blocked-emails/route");
      const res = await GET(req("/api/platform/blocked-emails", "GET"), noParams);
      expect(res.status).toBe(403);
    });

    it("lists platform-level blocked emails without the q filter", async () => {
      await asStaff("STAFF_OBSERVER");
      const email = `listed-${stamp()}@x.test`;
      await prisma.blockedEmail.create({ data: { eventId: null, email, reason: null } });
      const { GET } = await import("@/app/api/platform/blocked-emails/route");
      const res = await GET(req("/api/platform/blocked-emails", "GET"), noParams);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items.some((i: { email: string }) => i.email === email)).toBe(true);
    });

    it("filters by q", async () => {
      await asStaff("STAFF_OBSERVER");
      const s = stamp();
      const matching = `match-${s}@x.test`;
      const other = `other-${s}@x.test`;
      await prisma.blockedEmail.create({ data: { eventId: null, email: matching, reason: null } });
      await prisma.blockedEmail.create({ data: { eventId: null, email: other, reason: null } });
      const { GET } = await import("@/app/api/platform/blocked-emails/route");
      const res = await GET(req(`/api/platform/blocked-emails?q=match-${s}`, "GET"), noParams);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items).toHaveLength(1);
      expect(json.items[0].email).toBe(matching);
    });

    it("does not include emails blocked at event level (eventId != null)", async () => {
      await asStaff("STAFF_OBSERVER");
      const org = await prisma.organization.create({ data: { name: "O", slug: `o-${stamp()}` } });
      const event = await prisma.event.create({
        data: { orgId: org.id, title: "E", slug: `e-${stamp()}`, location: "L", date: new Date() },
      });
      const eventScoped = `evt-${stamp()}@x.test`;
      await prisma.blockedEmail.create({
        data: { eventId: event.id, email: eventScoped, reason: null },
      });
      const { GET } = await import("@/app/api/platform/blocked-emails/route");
      const res = await GET(req("/api/platform/blocked-emails", "GET"), noParams);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items.some((i: { email: string }) => i.email === eventScoped)).toBe(false);
    });
  });

  describe("POST", () => {
    it("401 when not authenticated", async () => {
      noSession();
      const { POST } = await import("@/app/api/platform/blocked-emails/route");
      const res = await POST(req("/api/platform/blocked-emails", "POST", { email: "a@x.test" }), noParams);
      expect(res.status).toBe(401);
    });

    it("403 for a staff role below STAFF_SUPPORT", async () => {
      await asStaff("STAFF_OBSERVER");
      const { POST } = await import("@/app/api/platform/blocked-emails/route");
      const res = await POST(
        req("/api/platform/blocked-emails", "POST", { email: `d-${stamp()}@x.test` }),
        noParams,
      );
      expect(res.status).toBe(403);
    });

    it("400 on invalid email", async () => {
      await asStaff("STAFF_SUPPORT");
      const { POST } = await import("@/app/api/platform/blocked-emails/route");
      const res = await POST(req("/api/platform/blocked-emails", "POST", { email: "not-an-email" }), noParams);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("VALIDATION");
    });

    it("returns alreadyBlocked:true (200) when the email is already blocked platform-wide", async () => {
      await asStaff("STAFF_SUPPORT");
      const email = `dup-${stamp()}@x.test`;
      await prisma.blockedEmail.create({ data: { eventId: null, email, reason: null } });
      const { POST } = await import("@/app/api/platform/blocked-emails/route");
      const res = await POST(req("/api/platform/blocked-emails", "POST", { email }), noParams);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.alreadyBlocked).toBe(true);
    });

    it("400 on malformed JSON body (arrow .catch(()=>null))", async () => {
      await asStaff("STAFF_SUPPORT");
      const { POST } = await import("@/app/api/platform/blocked-emails/route");
      const raw = new NextRequest("http://localhost/api/platform/blocked-emails", {
        method: "POST",
        body: "{not-json",
        headers: { "content-type": "application/json" },
      });
      const res = await POST(raw, noParams);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("VALIDATION");
    });

    it("creates a platform-level entry (201) without a reason (reason ?? null)", async () => {
      await asStaff("STAFF_SUPPORT");
      const email = `noreason-${stamp()}@x.test`;
      const { POST } = await import("@/app/api/platform/blocked-emails/route");
      const res = await POST(req("/api/platform/blocked-emails", "POST", { email }), noParams);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.item.email).toBe(email);
      expect(json.item.reason).toBeNull();
    });

    it("creates a platform-level entry (201), normalizes the email, and logs PLATFORM_BLOCKED_EMAIL_ADDED", async () => {
      const staff = await asStaff("STAFF_SUPPORT");
      // z.string().email() valide AVANT le .transform() : pas d'espaces dans la valeur brute,
      // seule la casse permet de verifier la normalisation (toLowerCase).
      const raw = `NEW-${stamp()}@X.TEST`;
      const { POST } = await import("@/app/api/platform/blocked-emails/route");
      const res = await POST(
        req("/api/platform/blocked-emails", "POST", { email: raw, reason: "spam" }),
        noParams,
      );
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.item.email).toBe(raw.toLowerCase());
      expect(json.item.eventId).toBeNull();

      const log = await prisma.activityLog.findFirst({
        where: { type: "PLATFORM_BLOCKED_EMAIL_ADDED", targetId: json.item.id },
      });
      expect(log).not.toBeNull();
      expect(log?.userId).toBe(staff.id);
    });
  });
});
