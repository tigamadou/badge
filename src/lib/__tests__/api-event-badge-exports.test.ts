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

import { createBadgeFixtures } from "@/lib/badge-templates/__tests__/badge-fixtures";
import { POST } from "@/app/api/org/[orgId]/events/[eventId]/badges/exports/route";
import { GET } from "@/app/api/org/[orgId]/events/[eventId]/badges/exports/[exportId]/route";

function post(orgId: string, eventId: string, body: unknown) {
  return POST(
    new NextRequest(`http://localhost/api/org/${orgId}/events/${eventId}/badges/exports`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ orgId, eventId }) },
  );
}

function get(orgId: string, eventId: string, exportId: string) {
  return GET(
    new NextRequest(`http://localhost/api/org/${orgId}/events/${eventId}/badges/exports/${exportId}`),
    { params: Promise.resolve({ orgId, eventId, exportId }) } as never,
  );
}

describe("POST /api/org/[orgId]/events/[eventId]/badges/exports", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("401 sans session", async () => {
    const { org, event } = await createBadgeFixtures();
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await post(org.id, event.id, { ids: ["x"] })).status).toBe(401);
  });

  it("403 pour un VIEWER sans badge.print", async () => {
    const { org, event, addRegistration } = await createBadgeFixtures({ role: "VIEWER", orgOwner: false });
    const a = await addRegistration();
    const res = await post(org.id, event.id, { ids: [a.id] });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("EVENT_FORBIDDEN");
  });

  it("201 pour un PRINTER pur ; ordre conserve, doublons retires, journal BADGE_BATCH_EXPORTED", async () => {
    const { admin, org, event, addRegistration } = await createBadgeFixtures({ role: "PRINTER", orgOwner: false });
    const a = await addRegistration();
    const b = await addRegistration();
    const c = await addRegistration();
    const res = await post(org.id, event.id, { ids: [c.id, a.id, c.id, b.id] });
    expect(res.status).toBe(201);
    const { export: exp } = await res.json();
    expect(exp).toMatchObject({ status: "PENDING", badgeCount: 3, fileKey: null });
    expect(exp.registrationIds).toBeUndefined();

    const row = await prisma.printSheetGeneration.findUniqueOrThrow({ where: { id: exp.id } });
    expect(row.output).toBe("ZIP");
    expect(row.layoutId).toBeNull();
    expect(row.layoutSnapshot).toBeNull();
    expect(row.createdById).toBe(admin.id);
    expect(row.registrationIds).toEqual([c.id, a.id, b.id]);

    const log = await prisma.activityLog.findFirstOrThrow({
      where: { type: "BADGE_BATCH_EXPORTED", eventId: event.id },
    });
    expect(log.userId).toBe(admin.id);
    expect(log.details).toMatchObject({ format: "zip", count: 3 });
  });

  it("201 avec 750 identifiants : aucune limite", async () => {
    const { org, event, category } = await createBadgeFixtures();
    const stamp = Date.now();
    const rows = Array.from({ length: 750 }, (_, i) => ({ n: i, id: `BULK-${stamp}-${i}` }));
    await prisma.user.createMany({
      data: rows.map((r) => ({ id: `u-${r.id}`, email: `${r.id}@bulk.test`, password: "x", name: "B" })),
    });
    await prisma.registration.createMany({
      data: rows.map((r) => ({
        id: r.id,
        eventId: event.id,
        categoryId: category.id,
        userId: `u-${r.id}`,
        snapshotFirstName: "A",
        snapshotLastName: "B",
        snapshotEmail: `${r.id}@bulk.test`,
        snapshotStructure: "S",
        snapshotPhoto: "",
        snapshotIdDocumentType: "CNI" as const,
        snapshotIdDocumentNumber: String(r.n),
        snapshotIdDocument: "",
        status: "APPROVED" as const,
      })),
    });
    const res = await post(org.id, event.id, { ids: rows.map((r) => r.id) });
    expect(res.status).toBe(201);
    expect((await res.json()).export.badgeCount).toBe(750);
  }, 60_000);

  it("fonctionne sur un evenement archive", async () => {
    const { org, event, addRegistration } = await createBadgeFixtures();
    const a = await addRegistration();
    await prisma.event.update({ where: { id: event.id }, data: { archived: true, archivedAt: new Date() } });
    expect((await post(org.id, event.id, { ids: [a.id] })).status).toBe(201);
  });

  it("400 VALIDATION si le corps est invalide", async () => {
    const { org, event } = await createBadgeFixtures();
    for (const body of [{}, { ids: "a" }, { ids: [1] }]) {
      const res = await post(org.id, event.id, body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "VALIDATION" });
    }
  });

  it("400 EMPTY_SELECTION sans identifiant", async () => {
    const { org, event } = await createBadgeFixtures();
    const res = await post(org.id, event.id, { ids: [] });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("EMPTY_SELECTION");
  });

  it("400 INVALID_SELECTION : inscription non approuvee, inconnue ou d'un autre evenement", async () => {
    const other = await createBadgeFixtures();
    const foreign = await other.addRegistration();
    const { org, event, addRegistration } = await createBadgeFixtures();
    const ok = await addRegistration();
    const pending = await addRegistration({ status: "PENDING" });
    for (const ids of [[ok.id, pending.id], [ok.id, "ghost-xyz"], [ok.id, foreign.id]]) {
      const res = await post(org.id, event.id, { ids });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("INVALID_SELECTION");
    }
    expect(await prisma.printSheetGeneration.count({ where: { eventId: event.id } })).toBe(0);
  });
});

describe("GET /api/org/[orgId]/events/[eventId]/badges/exports/[exportId]", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("renvoie le statut et la cle du fichier", async () => {
    const { org, event, addRegistration } = await createBadgeFixtures({ role: "PRINTER", orgOwner: false });
    const a = await addRegistration();
    const { export: exp } = await (await post(org.id, event.id, { ids: [a.id] })).json();
    await prisma.printSheetGeneration.update({
      where: { id: exp.id },
      data: { status: "DONE", fileKey: `badge-exports/${event.id}/${exp.id}.zip` },
    });
    const res = await get(org.id, event.id, exp.id);
    expect(res.status).toBe(200);
    expect((await res.json()).export).toMatchObject({
      id: exp.id,
      status: "DONE",
      fileKey: `badge-exports/${event.id}/${exp.id}.zip`,
    });
  });

  it("404 pour l'export d'un autre evenement", async () => {
    const mine = await createBadgeFixtures();
    const other = await createBadgeFixtures();
    const r = await other.addRegistration();
    // La session pointe sur l'organisateur de `other` : on cree l'export la-bas, on le lit via `mine`.
    const { export: exp } = await (await post(other.org.id, other.event.id, { ids: [r.id] })).json();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: mine.admin.id, email: mine.admin.email, name: mine.admin.name, isStaff: false },
    } as never);
    expect((await get(mine.org.id, mine.event.id, exp.id)).status).toBe(404);
    expect((await get(mine.org.id, mine.event.id, "inconnu")).status).toBe(404);
  });

  it("403 pour un VIEWER", async () => {
    const { org, event } = await createBadgeFixtures({ role: "VIEWER", orgOwner: false });
    expect((await get(org.id, event.id, "x")).status).toBe(403);
  });
});
