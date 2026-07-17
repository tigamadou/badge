import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

async function asUser(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

describe("Espace staff — criteres d'acceptation v2-02", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    await prisma.platformSettings.deleteMany();
    await prisma.platformSettings.create({
      data: {
        id: "singleton",
        smtpHost: "smtp",
        smtpPort: 587,
        smtpFrom: "from@x.com",
        smtpUser: "",
        smtpPassword: "",
        smtpSecure: false,
        recaptchaEnabled: false,
        recaptchaSiteKey: "",
        recaptchaSecretKey: "",
      },
    });
    vi.mocked(getServerSession).mockReset();
  });

  it("AC1 + AC2 : non-staff bloque ; STAFF_OBSERVER lit mais ne mute pas", async () => {
    const u = await prisma.user.create({
      data: { email: "u@x.com", password: "x", name: "U" },
    });
    await asUser({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET, POST } = await import("@/app/api/platform/organizations/route");
    let res = await GET(
      new NextRequest("http://localhost/api/platform/organizations"),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(403);

    const obs = await prisma.user.create({
      data: {
        email: "obs@x.com",
        password: "x",
        name: "Obs",
        isStaff: true,
        staffRole: "STAFF_OBSERVER",
      },
    });
    await asUser({ id: obs.id, email: obs.email, name: obs.name, isStaff: true });
    res = await GET(
      new NextRequest("http://localhost/api/platform/organizations"),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);

    res = await POST(
      new NextRequest("http://localhost/api/platform/organizations", {
        method: "POST",
        body: JSON.stringify({ name: "X", ownerEmail: "x@x.com", ownerName: "X" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(403);
  });

  it("AC3 + AC5 : STAFF_ADMIN cree une org, l'action est tracee staffActor=true", async () => {
    const admin = await prisma.user.create({
      data: {
        email: "a@x.com",
        password: "x",
        name: "Admin",
        isStaff: true,
        staffRole: "STAFF_ADMIN",
      },
    });
    await asUser({ id: admin.id, email: admin.email, name: admin.name, isStaff: true });

    const { POST } = await import("@/app/api/platform/organizations/route");
    const res = await POST(
      new NextRequest("http://localhost/api/platform/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: "AC3",
          ownerEmail: "owner-ac3@x.com",
          ownerName: "Owner",
          quotaMaxEvents: 10,
        }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    const orgId = json.organization?.id ?? json.org?.id ?? json.id;
    expect(orgId).toBeTruthy();

    const logs = await prisma.activityLog.findMany({ where: { orgId } });
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs.every((l) => l.staffActor === true)).toBe(true);
  });

  it("AC6 : GET /staff/settings ne fuit jamais smtpPassword ni recaptchaSecretKey", async () => {
    await prisma.platformSettings.update({
      where: { id: "singleton" },
      data: { smtpPassword: "VERY_SECRET", recaptchaSecretKey: "ALSO_SECRET" },
    });
    const obs = await prisma.user.create({
      data: {
        email: "o@x.com",
        password: "x",
        name: "Obs",
        isStaff: true,
        staffRole: "STAFF_OBSERVER",
      },
    });
    await asUser({ id: obs.id, email: obs.email, name: obs.name, isStaff: true });

    const { GET } = await import("@/app/api/platform/settings/route");
    const res = await GET(
      new NextRequest("http://localhost/api/platform/settings"),
      { params: Promise.resolve({}) },
    );
    const text = await res.text();
    expect(text).not.toContain("VERY_SECRET");
    expect(text).not.toContain("ALSO_SECRET");
  });

  it("AC8 : POST /staff/users genere un inviteToken (~24h)", async () => {
    const admin = await prisma.user.create({
      data: {
        email: "ac8@x.com",
        password: "x",
        name: "AC8",
        isStaff: true,
        staffRole: "STAFF_ADMIN",
      },
    });
    await asUser({ id: admin.id, email: admin.email, name: admin.name, isStaff: true });

    const { POST } = await import("@/app/api/platform/users/route");
    const before = Date.now();
    const res = await POST(
      new NextRequest("http://localhost/api/platform/users", {
        method: "POST",
        body: JSON.stringify({ email: "invited@x.com", name: "Inv", type: "client" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(201);

    const created = await prisma.user.findUnique({ where: { email: "invited@x.com" } });
    expect(created?.inviteToken).toBeTruthy();
    expect(created?.inviteTokenExpiry).not.toBeNull();
    const expiresIn = (created!.inviteTokenExpiry!.getTime() - before) / 1000;
    expect(expiresIn).toBeGreaterThan(23 * 3600);
    expect(expiresIn).toBeLessThan(25 * 3600);
  });
});
