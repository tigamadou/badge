import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Ces tests couvrent la branche `throw err` des wrappers : quand le guard leve une
// erreur qui n'est PAS une AuthError, le wrapper doit la relayer telle quelle (et non
// la transformer en Response). On ne peut pas provoquer une erreur non-AuthError avec
// la vraie DB (les guards ne levent que des AuthError), d'ou le mock partiel du module
// auth-guards. La vraie classe AuthError est conservee pour que `instanceof` reste correct.
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

vi.mock("@/lib/auth-guards", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/auth-guards")>();
  return {
    ...actual,
    requireOrgRole: vi.fn(),
    requireStaff: vi.fn(),
    requireEventRole: vi.fn(),
  };
});

import { requireOrgRole, requireStaff, requireEventRole } from "@/lib/auth-guards";
import { withOrgAuth } from "@/lib/with-org-auth";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { withEventAuth } from "@/lib/with-event-auth";

function mockSession() {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: "u1", email: "u@x", name: "U", isStaff: false },
  } as never);
}

describe("wrappers rethrow non-AuthError from the guard", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
    vi.mocked(requireOrgRole).mockReset();
    vi.mocked(requireStaff).mockReset();
    vi.mocked(requireEventRole).mockReset();
  });

  it("withOrgAuth rethrows a non-AuthError raised by requireOrgRole", async () => {
    mockSession();
    vi.mocked(requireOrgRole).mockRejectedValue(new Error("boom-org"));

    const handler = withOrgAuth("OWNER", async () => new Response("ok"));
    const req = new NextRequest("http://localhost/api/org/org-1");
    await expect(
      handler(req, { params: Promise.resolve({ orgId: "org-1" }) }),
    ).rejects.toThrow("boom-org");
  });

  it("withStaffAuth rethrows a non-AuthError raised by requireStaff", async () => {
    mockSession();
    vi.mocked(requireStaff).mockRejectedValue(new Error("boom-staff"));

    const handler = withStaffAuth(async () => new Response("ok"));
    const req = new NextRequest("http://localhost/api/platform/organizations");
    await expect(
      handler(req, { params: Promise.resolve({}) }),
    ).rejects.toThrow("boom-staff");
  });

  it("withEventAuth rethrows a non-AuthError raised by requireEventRole", async () => {
    // prisma n'est pas mocke : le wrapper verifie l'event en base avant d'appeler le guard.
    const org = await prisma.organization.create({
      data: { name: "Org", slug: `org-rethrow-${Date.now()}` },
    });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        title: "Evt",
        slug: `evt-rethrow-${Date.now()}`,
        location: "L",
        date: new Date(),
      },
    });
    mockSession();
    vi.mocked(requireEventRole).mockRejectedValue(new Error("boom-event"));

    const handler = withEventAuth({ minRole: "OPERATOR" }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`);
    await expect(
      handler(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) }),
    ).rejects.toThrow("boom-event");

    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
  });
});
