import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeStaff } from "@/test/factories";
import { makeFramedTemplate, makePng, putTestImage } from "@/test/factories-2a";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

// Les gardes d'abonnement sont couverts ailleurs : ici l'organisation est considérée active
// (les évènements ont une date en dur qui finirait par passer).
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

afterAll(async () => {
  await prisma.activityLog.deleteMany();
  await prisma.eventSettings.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
});

async function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

async function seedAdmin() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const u = await prisma.user.create({
    data: { email: `a-${stamp}@x.test`, password: "x", name: "A" },
  });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${stamp}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "Old", slug: `evt-${stamp}`, location: "L", date: new Date("2026-12-01") },
  });
  await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
  return { u, org, event };
}

describe("PATCH /api/org/[orgId]/events/[eventId]", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("ADMIN updates title, location, date, registrationOpen", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: "New",
        location: "Paris",
        date: "2026-12-15",
        registrationOpen: true,
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.event.findUnique({ where: { id: event.id } });
    expect(updated?.title).toBe("New");
    expect(updated?.location).toBe("Paris");
    expect(updated?.registrationOpen).toBe(true);
    expect(updated?.date.toISOString().slice(0, 10)).toBe("2026-12-15");
  });

  it("met a jour la description et la date de fin", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ date: "2026-12-16", description: "Nouvelle description.", endDate: "2026-12-18" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
    const updated = await prisma.event.findUnique({ where: { id: event.id } });
    expect(updated?.description).toBe("Nouvelle description.");
    expect(updated?.endDate?.toISOString().slice(0, 10)).toBe("2026-12-18");
  });

  it("efface la date de fin quand endDate vaut null", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.event.update({ where: { id: event.id }, data: { endDate: new Date("2026-12-05") } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ endDate: null }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
    const updated = await prisma.event.findUnique({ where: { id: event.id } });
    expect(updated?.endDate).toBeNull();
  });

  it("refuse une date de fin anterieure a la date de l'evenement", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ endDate: "2020-01-01" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
  });

  it("slug is immutable for non-staff (ignored silently)", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ slug: "new-slug" }),
      headers: { "content-type": "application/json" },
    });
    await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    const updated = await prisma.event.findUnique({ where: { id: event.id } });
    expect(updated?.slug).not.toBe("new-slug");
  });

  it("staff can update slug", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const s = await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-staff-${stamp}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "T", slug: `old-slug-${stamp}`, location: "L", date: new Date() },
    });
    await withSession({ id: s.id, email: s.email, name: s.name, isStaff: true });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ slug: `new-slug-${stamp}` }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
    const updated = await prisma.event.findUnique({ where: { id: event.id } });
    expect(updated?.slug).toBe(`new-slug-${stamp}`);
  });

  it("toggle registrationOpen=true emits EVENT_REGISTRATION_OPENED log", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ registrationOpen: true }),
      headers: { "content-type": "application/json" },
    });
    await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    const log = await prisma.activityLog.findFirst({ where: { type: "EVENT_REGISTRATION_OPENED" } });
    expect(log?.eventId).toBe(event.id);
  });

  it("toggle registrationOpen=false emits EVENT_REGISTRATION_CLOSED log", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({
      data: { email: `rc-${stamp}@x.test`, password: "x", name: "RC" },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-rc-${stamp}` } });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        title: "Open",
        slug: `evt-rc-${stamp}`,
        location: "L",
        date: new Date("2026-12-01"),
        registrationOpen: true,
      },
    });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ registrationOpen: false }),
      headers: { "content-type": "application/json" },
    });
    await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    const log = await prisma.activityLog.findFirst({ where: { type: "EVENT_REGISTRATION_CLOSED" } });
    expect(log?.eventId).toBe(event.id);
  });

  it("OPERATOR cannot PATCH event (403)", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({ data: { email: `op-${stamp}@x.test`, password: "x", name: "Op" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-op-${stamp}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "T", slug: `evt-op-${stamp}`, location: "L", date: new Date() },
    });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "x" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(403);
  });

  it("updates logo field", async () => {
    const { u, org, event } = await seedAdmin();
    const logoKey = await putTestImage(`orgs/${org.id}/images/settings-logo-${event.id}.png`, makePng(136, 136), "image/png");
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ logo: logoKey }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.event.findUnique({ where: { id: event.id } });
    expect(updated?.logo).toBe(logoKey);
  });

  it("returns 400 VALIDATION for a malformed date value", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ date: "not-a-date" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("VALIDATION");
  });

  it("returns 400 VALIDATION for a malformed JSON body", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: "not-json{",
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("VALIDATION");
  });

  it("returns 409 SLUG_TAKEN when staff reuses another event's slug", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const staff = await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-${stamp}` } });
    const taken = await prisma.event.create({
      data: { orgId: org.id, title: "E1", slug: `taken-${stamp}`, location: "L", date: new Date() },
    });
    const target = await prisma.event.create({
      data: { orgId: org.id, title: "E2", slug: `free-${stamp}`, location: "L", date: new Date() },
    });
    await withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${target.id}`, {
      method: "PATCH",
      body: JSON.stringify({ slug: taken.slug }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: target.id }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("SLUG_TAKEN");
  });

  it("rethrows a non-SLUG_TAKEN prisma error (invalid calendar date serialization)", async () => {
    // "2023-13-40" passe le regex \d{4}-\d{2}-\d{2} (validation zod) mais produit un
    // Invalid Date via `new Date(...)` (l.54) : sa serialisation cote Prisma leve une
    // erreur sans `.code` "P2002", ce qui exerce la branche `throw err` (l.90).
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ date: "2023-13-40" }),
      headers: { "content-type": "application/json" },
    });
    await expect(
      PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) }),
    ).rejects.toThrow();
  });

  it("enregistre les consignes de securite nettoyees", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ securityInstructions: ["  Restez dans la zone. ", "", "Badge visible."] }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.event.securityInstructions).toEqual(["Restez dans la zone.", "Badge visible."]);
    const updated = await prisma.event.findUnique({ where: { id: event.id } });
    expect(updated?.securityInstructions).toEqual(["Restez dans la zone.", "Badge visible."]);
  });

  it("n'ecrit pas les consignes inchangees (changedFields sans securityInstructions)", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.event.update({ where: { id: event.id }, data: { securityInstructions: ["Identique"] } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "Autre titre", securityInstructions: [" Identique ", ""] }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
    const log = await prisma.activityLog.findFirst({ where: { type: "EVENT_UPDATED", eventId: event.id } });
    const fields = (log?.details as { changedFields: string[] }).changedFields;
    expect(fields).toContain("title");
    expect(fields).not.toContain("securityInstructions");
  });

  async function patchEvent(input: unknown | ((org: { id: string }) => Promise<unknown>)) {
    const { u, org, event } = await seedAdmin();
    const body = typeof input === "function" ? await input(org) : input;
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    return { res, org, event, u, PATCH };
  }

  it("ecrit puis efface la banniere", async () => {
    let bannerKey = "";
    const { res, event, org, PATCH } = await patchEvent(async (o: { id: string }) => {
      bannerKey = await putTestImage(`orgs/${o.id}/images/settings-banner-${Date.now()}.png`, makePng(1500, 500), "image/png");
      return { banner: bannerKey };
    });
    expect(res.status).toBe(200);
    expect((await prisma.event.findUnique({ where: { id: event.id } }))?.banner).toBe(bannerKey);
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ banner: null }),
      headers: { "content-type": "application/json" },
    });
    const res2 = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res2.status).toBe(200);
    expect((await prisma.event.findUnique({ where: { id: event.id } }))?.banner).toBeNull();
  });

  it("enregistre des templateOptions valides et les renvoie", async () => {
    const opts = { showColorBar: false, zone: "C", lignes: ["a"] };
    const { res, event } = await patchEvent({ templateOptions: opts });
    expect(res.status).toBe(200);
    expect((await res.json()).event.templateOptions).toEqual(opts);
    expect((await prisma.event.findUnique({ where: { id: event.id } }))?.templateOptions).toEqual(opts);
  });

  it("nettoie les listes de templateOptions cote serveur", async () => {
    const { res, event } = await patchEvent({ templateOptions: { lignes: ["  a ", "", "b"] } });
    expect(res.status).toBe(200);
    expect((await res.json()).event.templateOptions).toEqual({ lignes: ["a", "b"] });
    expect((await prisma.event.findUnique({ where: { id: event.id } }))?.templateOptions).toEqual({
      lignes: ["a", "b"],
    });
  });

  it("l'objet envoye remplace les options enregistrees", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.event.update({ where: { id: event.id }, data: { templateOptions: { ancien: true } } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ templateOptions: { zone: "C" } }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
    expect((await prisma.event.findUnique({ where: { id: event.id } }))?.templateOptions).toEqual({ zone: "C" });
  });

  it.each([
    ["51 cles", Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`k${i}`, "v"]))],
    ["cle en majuscule", { Zone: "C" }],
    ["cle reservee", { "event.banner": "x" }],
    ["chaine de 501 caracteres", { zone: "a".repeat(501) }],
    ["liste de 31 elements", { lignes: Array.from({ length: 31 }, () => "a") }],
    ["valeur numerique", { zone: 3 }],
  ])("refuse les templateOptions invalides : %s", async (_nom, templateOptions) => {
    const { res } = await patchEvent({ templateOptions });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("VALIDATION");
  });

  it("n'ecrit pas les templateOptions inchangees (changedFields sans templateOptions)", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.event.update({ where: { id: event.id }, data: { templateOptions: { zone: "C" } } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "T2", templateOptions: { zone: "C" } }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
    const log = await prisma.activityLog.findFirst({ where: { type: "EVENT_UPDATED", eventId: event.id } });
    const fields = (log?.details as { changedFields: string[] }).changedFields;
    expect(fields).toContain("title");
    expect(fields).not.toContain("templateOptions");
  });

  it("n'ecrit pas les templateOptions identiques envoyees dans un autre ordre de cles", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.event.update({ where: { id: event.id }, data: { templateOptions: { a: "1", b: ["x"], c: true } } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "T3", templateOptions: { c: true, b: ["x"], a: "1" } }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
    const log = await prisma.activityLog.findFirst({ where: { type: "EVENT_UPDATED", eventId: event.id } });
    const fields = (log?.details as { changedFields: string[] }).changedFields;
    expect(fields).toContain("title");
    expect(fields).not.toContain("templateOptions");
  });

  it("renvoie 400 NOTHING_TO_UPDATE quand seules des consignes inchangees sont envoyees", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.event.update({ where: { id: event.id }, data: { securityInstructions: ["Identique"] } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ securityInstructions: ["Identique"] }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("NOTHING_TO_UPDATE");
  });

  it("vide les consignes avec un tableau vide", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.event.update({ where: { id: event.id }, data: { securityInstructions: ["Ancienne"] } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ securityInstructions: [] }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
    const updated = await prisma.event.findUnique({ where: { id: event.id } });
    expect(updated?.securityInstructions).toEqual([]);
  });

  it.each([
    ["trop de consignes", Array.from({ length: 31 }, (_, i) => `Consigne ${i}`)],
    ["une consigne trop longue", ["x".repeat(501)]],
  ])("refuse %s (400 VALIDATION)", async (_cas, securityInstructions) => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ securityInstructions }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("VALIDATION");
  });
});

describe("GET /api/org/[orgId]/events/[eventId]", () => {
  beforeEach(cleanupSettings);

  it("returns full event detail with organization + counts", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.event.id).toBe(event.id);
    expect(json.event.slug).toBe(event.slug);
    expect(json.event.orgId).toBe(org.id);
    expect(json.event.organization).toEqual({ id: org.id, name: org.name, slug: org.slug });
    expect(json.event._count).toEqual({ registrations: 0, categories: 0, memberships: 1 });
    expect(json.event.securityInstructions).toEqual([]);
  });
});

async function cleanupSettings() {
  await prisma.activityLog.deleteMany();
  await prisma.eventSettings.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
  vi.mocked(getServerSession).mockReset();
}

describe("GET /api/org/[orgId]/events/[eventId]/settings", () => {
  beforeEach(cleanupSettings);

  it("returns an empty settings object when no EventSettings override exists", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/settings/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/settings`);
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.settings).toEqual({});
  });

  it("returns event settings + resolved cascade preview", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.eventSettings.create({
      data: { eventId: event.id, contactEmail: "c@evt.test", contactPhone: "+225 0101" },
    });
    await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        smtpHost: "p",
        smtpPort: 587,
        smtpFrom: "p@x.test",
        smtpUser: "",
        smtpPassword: "",
        smtpSecure: false,
        recaptchaEnabled: false,
        recaptchaSiteKey: "",
        recaptchaSecretKey: "",
      },
      update: {},
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/settings/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/settings`);
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.settings.contactEmail).toBe("c@evt.test");
    expect(json.settings.contactPhone).toBe("+225 0101");
    expect("smtpFrom" in json.settings).toBe(false);
    expect("smtpPassword" in json.resolved).toBe(false);
    expect("recaptchaSecretKey" in json.resolved).toBe(false);
  });
});

describe("PATCH /api/org/[orgId]/events/[eventId]/settings", () => {
  beforeEach(cleanupSettings);

  it("upserts EventSettings and audits EVENT_SETTINGS_UPDATED", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/settings/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/settings`, {
      method: "PATCH",
      body: JSON.stringify({ contactEmail: "ce@x.test", contactPhone: "+225 0101" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);

    const s = await prisma.eventSettings.findUnique({ where: { eventId: event.id } });
    expect(s?.contactEmail).toBe("ce@x.test");
    expect(s?.contactPhone).toBe("+225 0101");
    const log = await prisma.activityLog.findFirst({ where: { type: "EVENT_SETTINGS_UPDATED" } });
    expect(log?.eventId).toBe(event.id);
  });

  it("null resets the override (cascade fallback)", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.eventSettings.create({ data: { eventId: event.id, contactEmail: "old@x.test" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/settings/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/settings`, {
      method: "PATCH",
      body: JSON.stringify({ contactEmail: null }),
      headers: { "content-type": "application/json" },
    });
    await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    const s = await prisma.eventSettings.findUnique({ where: { eventId: event.id } });
    expect(s?.contactEmail).toBeNull();
  });

  it("refuses fields not allowed at event level (smtpFrom, smtpHost, smtpPassword)", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/settings/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/settings`, {
      method: "PATCH",
      body: JSON.stringify({ smtpFrom: "leak@x.test", smtpHost: "evil.smtp", smtpPassword: "leak" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 VALIDATION for a malformed JSON body", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/settings/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/settings`, {
      method: "PATCH",
      body: "not-json{",
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("VALIDATION");
  });
});

describe("PATCH /api/org/[orgId]/events/[eventId] : images", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  async function setup() {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const staff = await makeStaff("SUPER_ADMIN");
    const template = await makeFramedTemplate(staff.id, { logo: { w: 68, h: 68 }, banner: { w: 750, h: 250 } });
    await prisma.event.update({ where: { id: event.id }, data: { badgeTemplateId: template.id } });
    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const patch = (body: unknown) =>
      PATCH(
        new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }),
        { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
      );
    const put = (name: string, w: number, h: number) =>
      putTestImage(`events/${event.id}/photos/patch-${name}.png`, makePng(w, h), "image/png");
    const row = () => prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    return { event, patch, put, row, staff };
  }

  it("enregistre un logo conforme, ses dimensions et une ligne de journal", async () => {
    const { event, patch, put, row } = await setup();
    const logo = await put("ok", 136, 136);
    const original = await put("orig", 800, 600);
    const res = await patch({ logo, logoOriginal: original });
    expect(res.status).toBe(200);
    expect(await row()).toMatchObject({ logo, logoOriginal: original, logoWidth: 136, logoHeight: 136 });
    const logs = await prisma.activityLog.findMany({ where: { eventId: event.id, type: "EVENT_IMAGE_UPDATED" } });
    expect(logs).toHaveLength(1);
    expect(logs[0].details).toEqual({ slot: "logo", removed: false });
  });

  it("refuse un logo hors ratio et laisse la colonne inchangée", async () => {
    const { patch, put, row } = await setup();
    const res = await patch({ logo: await put("bad", 300, 100) });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: "IMAGE_RATIO", slot: "logo" });
    expect((await row()).logo).toBeNull();
  });

  it("refuse une clé inexistante", async () => {
    const { event, patch } = await setup();
    const res = await patch({ banner: `events/${event.id}/photos/inexistant.png` });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "INVALID_IMAGE", slot: "banner" });
  });

  it("refuse une clé d'un autre dossier, même existante, et un original hors périmètre", async () => {
    const { patch } = await setup();
    const foreign = await putTestImage("orgs/autre-org/images/logo.png", makePng(136, 136), "image/png");
    const res = await patch({ logo: foreign });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "INVALID_IMAGE", slot: "logo" });
    const original = await patch({ logoOriginal: "profile/quelquun/photos/p.png" });
    expect(original.status).toBe(400);
    expect(await original.json()).toMatchObject({ code: "INVALID_IMAGE" });
  });

  it("ne revalide pas une image inchangée (pas de blocage rétroactif)", async () => {
    const { event, patch, put, row } = await setup();
    const logo = await put("old", 300, 100);
    await prisma.event.update({ where: { id: event.id }, data: { logo } });
    const res = await patch({ logo, title: "Autre titre" });
    expect(res.status).toBe(200);
    expect((await row()).logo).toBe(logo);
    expect(await prisma.activityLog.count({ where: { type: "EVENT_IMAGE_UPDATED" } })).toBe(0);
  });

  it("accepte un original ancien hors périmètre renvoyé inchangé", async () => {
    const { event, patch, row } = await setup();
    const legacy = "legacy/ancien-logo-original.png";
    await prisma.event.update({ where: { id: event.id }, data: { logoOriginal: legacy } });
    const res = await patch({ logoOriginal: legacy, title: "Autre titre" });
    expect(res.status).toBe(200);
    expect((await row()).logoOriginal).toBe(legacy);
  });

  it("efface la clé, les dimensions et l'original avec null", async () => {
    const { event, patch, put, row } = await setup();
    const logo = await put("rm", 136, 136);
    await prisma.event.update({
      data: { logo, logoOriginal: logo, logoWidth: 136, logoHeight: 136 },
      where: { id: event.id },
    });
    const res = await patch({ logo: null, logoOriginal: logo });
    expect(res.status).toBe(200);
    expect(await row()).toMatchObject({ logo: null, logoOriginal: null, logoWidth: null, logoHeight: null });
    const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "EVENT_IMAGE_UPDATED" } });
    expect(log.details).toEqual({ slot: "logo", removed: true });
  });

  it("enregistre l'original de la bannière seul", async () => {
    const { patch, put, row } = await setup();
    const original = await put("b-orig", 3000, 900);
    expect((await patch({ bannerOriginal: original })).status).toBe(200);
    expect((await row()).bannerOriginal).toBe(original);
  });

  it("contrôle la bannière contre son cadre et mémorise ses dimensions", async () => {
    const { patch, put, row } = await setup();
    expect((await patch({ banner: await put("b-bad", 1000, 1000) })).status).toBe(422);
    const banner = await put("b-ok", 1500, 500);
    expect((await patch({ banner })).status).toBe(200);
    expect(await row()).toMatchObject({ bannerWidth: 1500, bannerHeight: 500 });
  });
});
