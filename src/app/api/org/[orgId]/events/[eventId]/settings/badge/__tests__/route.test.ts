import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureReferenceTemplates, defaultTemplateId, familyTemplateId } from "@/lib/badge-templates/install";

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

// Tests Plan v2-12 : PATCH event.badgeTemplateId. Permission event.settings.update
// (ADMIN event uniquement). Route geree par withEventAuth + check explicite via
// hasEventPermission.

type OrgRoleStr = "OWNER" | "MANAGER" | "AUDITOR";
type EventRoleStr = "ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER";

function withSession(user: {
  id: string;
  email: string;
  name: string;
  isStaff: boolean;
}) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

async function setupPlatform() {
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    update: { badgeTemplateId: await installedDefaultId() },
    create: {
      id: "singleton",
      smtpHost: "mailpit",
      smtpPort: 1025,
      smtpFrom: "noreply@badge.local",
      smtpUser: "",
      smtpPassword: "",
      smtpSecure: false,
      recaptchaEnabled: false,
      recaptchaSiteKey: "",
      recaptchaSecretKey: "",
      badgeTemplateId: await installedDefaultId(),
    },
  });
}

async function makeEventWithMember(orgRole: OrgRoleStr, eventRole: EventRoleStr) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const user = await prisma.user.create({
    data: {
      email: `evt-${suffix}@v2-12.test`,
      password: "x",
      name: "Evt User",
      isStaff: false,
      emailVerifiedAt: new Date(),
    },
  });
  const org = await prisma.organization.create({
    data: { name: `Org ${suffix}`, slug: `org-${suffix}` },
  });
  await prisma.orgMembership.create({
    data: { userId: user.id, orgId: org.id, role: orgRole },
  });
  const event = await prisma.event.create({
    data: {
      orgId: org.id,
      title: `Salon ${suffix}`,
      slug: `evt-${suffix}`,
      location: "Abidjan",
      date: new Date("2026-10-01"),
    },
  });
  await prisma.eventMembership.create({
    data: { userId: user.id, eventId: event.id, role: eventRole },
  });
  withSession({ id: user.id, email: user.email, name: user.name, isStaff: false });
  return { user, org, event };
}

function makeReq(orgId: string, eventId: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/org/${orgId}/events/${eventId}/settings/badge`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    },
  );
}

// v4 (plan 12) : les templates livres sont installes en base. Un identifiant valide
// est donc un cuid, plus une chaine litterale.
async function installedDefaultId(): Promise<string> {
  await ensureReferenceTemplates("seed-test");
  return (await defaultTemplateId())!;
}

async function installedRectoVersoId(): Promise<string> {
  await ensureReferenceTemplates("seed-test");
  return (await familyTemplateId("recto-verso"))!;
}

describe("PATCH /api/org/[orgId]/events/[eventId]/settings/badge", () => {
  beforeEach(async () => {
    vi.mocked(getServerSession).mockReset();
    await setupPlatform();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const org = await prisma.organization.create({
      data: { name: "Org401", slug: `org-401-${Date.now()}` },
    });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        title: "E",
        slug: `evt-401-${Date.now()}`,
        location: "X",
        date: new Date("2026-10-01"),
      },
    });
    const { PATCH } = await import("../route");
    const req = makeReq(org.id, event.id, { badgeTemplateId: await installedDefaultId() });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for VIEWER (no event.settings.update permission)", async () => {
    const { org, event } = await makeEventWithMember("AUDITOR", "VIEWER");
    const { PATCH } = await import("../route");
    const req = makeReq(org.id, event.id, { badgeTemplateId: await installedDefaultId() });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(403);
  });

  it("ADMIN updates with valid templateId -> persist + log EVENT_SETTINGS_UPDATED", async () => {
    const { user, org, event } = await makeEventWithMember("OWNER", "ADMIN");
    const { PATCH } = await import("../route");
    const req = makeReq(org.id, event.id, { badgeTemplateId: await installedRectoVersoId() });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.badgeTemplateId).toBe(await installedRectoVersoId());

    const reloaded = await prisma.event.findUnique({ where: { id: event.id } });
    expect(reloaded?.badgeTemplateId).toBe(await installedRectoVersoId());

    const log = await prisma.activityLog.findFirst({
      where: { type: "EVENT_SETTINGS_UPDATED", userId: user.id, eventId: event.id },
    });
    expect(log).not.toBeNull();
    const details = log?.details as { field: string; value: string | null };
    expect(details.field).toBe("badgeTemplateId");
    expect(details.value).toBe(await installedRectoVersoId());
  });

  it("ADMIN updates with null -> persist null (heritage) + log", async () => {
    const { user, org, event } = await makeEventWithMember("OWNER", "ADMIN");
    // Pre-positionne une override pour observer la transition vers null.
    await prisma.event.update({
      where: { id: event.id },
      data: { badgeTemplateId: await installedRectoVersoId() },
    });

    const { PATCH } = await import("../route");
    const req = makeReq(org.id, event.id, { badgeTemplateId: null });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.badgeTemplateId).toBeNull();

    const reloaded = await prisma.event.findUnique({ where: { id: event.id } });
    expect(reloaded?.badgeTemplateId).toBeNull();

    const log = await prisma.activityLog.findFirst({
      where: { type: "EVENT_SETTINGS_UPDATED", userId: user.id, eventId: event.id },
    });
    expect(log).not.toBeNull();
    const details = log?.details as { field: string; value: string | null };
    expect(details.value).toBeNull();
  });

  it("ADMIN with a malformed JSON body -> 400 INVALID_BODY", async () => {
    // Exerce `req.json().catch(() => null)` (raw=null) puis l'echec zod qui en decoule :
    // bodySchema exige `badgeTemplateId` (string ou null), donc `null` echoue le parse.
    const { org, event } = await makeEventWithMember("OWNER", "ADMIN");
    const { PATCH } = await import("../route");
    const req = new NextRequest(
      `http://localhost/api/org/${org.id}/events/${event.id}/settings/badge`,
      { method: "PATCH", body: "not-json{", headers: { "content-type": "application/json" } },
    );
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_BODY");
  });

  it("ADMIN with wrong-shaped body (number instead of string) -> 400 INVALID_BODY", async () => {
    const { org, event } = await makeEventWithMember("OWNER", "ADMIN");
    const { PATCH } = await import("../route");
    const req = makeReq(org.id, event.id, { badgeTemplateId: 123 });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_BODY");
  });

  it("ADMIN with unknown templateId -> 400 UNKNOWN_TEMPLATE", async () => {
    const { org, event } = await makeEventWithMember("OWNER", "ADMIN");
    const { PATCH } = await import("../route");
    const req = makeReq(org.id, event.id, { badgeTemplateId: "ghost-xyz" });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("UNKNOWN_TEMPLATE");

    const reloaded = await prisma.event.findUnique({ where: { id: event.id } });
    expect(reloaded?.badgeTemplateId).toBeNull();
  });
});
