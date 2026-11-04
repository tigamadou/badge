import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureReferenceTemplates, familyTemplateId } from "@/lib/badge-templates/install";
import { makePng, putTestImage } from "@/test/factories-2a";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

// POST /api/org/[orgId]/events : choix du template de badge des la creation.

async function seedOwnerOrg() {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const user = await prisma.user.create({
    data: { email: `own-${suffix}@evt-create.test`, password: "x", name: "Own", emailVerifiedAt: new Date() },
  });
  const org = await prisma.organization.create({ data: { name: `Org ${suffix}`, slug: `org-${suffix}` } });
  const plan = await prisma.plan.create({
    data: { name: `plan-${suffix}`, maxEvents: 10, maxParticipantsPerEvent: null },
  });
  await prisma.subscription.create({ data: { orgId: org.id, planId: plan.id, status: "ACTIVE" } });
  await prisma.orgMembership.create({ data: { userId: user.id, orgId: org.id, role: "OWNER" } });
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: user.id, email: user.email, name: user.name, isStaff: false },
  } as never);
  return { user, org };
}

async function callPost(orgId: string, body: unknown) {
  const { POST } = await import("../route");
  return POST(
    new NextRequest(`http://localhost/api/org/${orgId}/events`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ orgId }) },
  );
}

const base = { title: "Salon", location: "Abidjan", date: "2026-12-15" };

describe("POST /api/org/[orgId]/events — template de badge", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("enregistre le template choisi et le journalise", async () => {
    const { org } = await seedOwnerOrg();
    await ensureReferenceTemplates("seed-test");
    const templateId = (await familyTemplateId("recto-verso"))!;

    const res = await callPost(org.id, { ...base, badgeTemplateId: templateId });
    expect(res.status).toBe(201);

    const { event } = (await res.json()) as { event: { id: string } };
    const row = await prisma.event.findUnique({ where: { id: event.id } });
    expect(row?.badgeTemplateId).toBe(templateId);

    const log = await prisma.activityLog.findFirst({ where: { type: "EVENT_CREATED", eventId: event.id } });
    expect((log?.details as { badgeTemplateId?: string } | null)?.badgeTemplateId).toBe(templateId);
  });

  it("laisse badgeTemplateId vide (heritage) sans le champ ou avec null", async () => {
    const { org } = await seedOwnerOrg();

    for (const body of [base, { ...base, badgeTemplateId: null }]) {
      const res = await callPost(org.id, body);
      expect(res.status).toBe(201);
      const { event } = (await res.json()) as { event: { id: string } };
      const row = await prisma.event.findUnique({ where: { id: event.id } });
      expect(row?.badgeTemplateId).toBeNull();
    }
  });

  it("refuse un template inconnu (400) et ne cree pas l'evenement", async () => {
    const { org } = await seedOwnerOrg();

    const res = await callPost(org.id, { ...base, badgeTemplateId: "inconnu" });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string; issues: { path: string[] }[] };
    expect(json.error).toBe("VALIDATION");
    expect(json.issues[0].path).toEqual(["badgeTemplateId"]);
    expect(await prisma.event.count({ where: { orgId: org.id } })).toBe(0);
  });
});

describe("POST /api/org/[orgId]/events : logo", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("memorise les dimensions d'un logo valide", async () => {
    const { org } = await seedOwnerOrg();
    const logo = await putTestImage(`test-2a/create-logo-${Date.now()}.png`, makePng(136, 136), "image/png");
    const res = await callPost(org.id, { ...base, logo });
    expect(res.status).toBe(201);
    const { event } = (await res.json()) as { event: { id: string } };
    expect(await prisma.event.findUnique({ where: { id: event.id } })).toMatchObject({
      logo,
      logoWidth: 136,
      logoHeight: 136,
    });
  });

  it("cree l'evenement meme si le logo est introuvable", async () => {
    const { org } = await seedOwnerOrg();
    const res = await callPost(org.id, { ...base, logo: "test-2a/absent.png" });
    expect(res.status).toBe(201);
    const { event } = (await res.json()) as { event: { id: string } };
    expect(await prisma.event.findUnique({ where: { id: event.id } })).toMatchObject({
      logoWidth: null,
      logoHeight: null,
    });
  });
});
