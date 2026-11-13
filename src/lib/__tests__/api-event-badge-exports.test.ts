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
    expect((await res.json()).error).toBe("PERMISSION_DENIED");
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

  it("reutilise (200) un export identique encore PENDING ou RUNNING du meme utilisateur", async () => {
    const { admin, org, event, addRegistration } = await createBadgeFixtures();
    const a = await addRegistration();
    const b = await addRegistration();
    const first = await post(org.id, event.id, { ids: [a.id, b.id] });
    expect(first.status).toBe(201);
    const { export: created } = await first.json();

    const again = await post(org.id, event.id, { ids: [a.id, b.id, a.id] });
    expect(again.status).toBe(200);
    expect((await again.json()).export.id).toBe(created.id);

    await prisma.printSheetGeneration.update({
      where: { id: created.id },
      data: { status: "RUNNING", lockedBy: "w", heartbeatAt: new Date(), attempts: 1 },
    });
    const running = await post(org.id, event.id, { ids: [a.id, b.id] });
    expect(running.status).toBe(200);
    expect((await running.json()).export).toMatchObject({ id: created.id, status: "RUNNING" });

    expect(await prisma.printSheetGeneration.count({ where: { eventId: event.id } })).toBe(1);
    // Pas de nouvelle entree de journal pour une reutilisation.
    expect(await prisma.activityLog.count({ where: { type: "BADGE_BATCH_EXPORTED", eventId: event.id } })).toBe(1);
    expect(admin.id).toBeTruthy();
  });

  it("ne reutilise pas : autre ordre, autre selection, autre utilisateur, export termine ou en echec", async () => {
    const { org, event, addRegistration } = await createBadgeFixtures();
    const a = await addRegistration();
    const b = await addRegistration();
    const { export: base } = await (await post(org.id, event.id, { ids: [a.id, b.id] })).json();

    const reversed = await post(org.id, event.id, { ids: [b.id, a.id] });
    expect(reversed.status).toBe(201);
    const subset = await post(org.id, event.id, { ids: [a.id] });
    expect(subset.status).toBe(201);

    // Autre utilisateur : l'export de base lui appartient plus.
    const other = await prisma.user.create({
      data: { email: `o-${Date.now()}@render.test`, password: "x", name: "O", emailVerifiedAt: new Date() },
    });
    await prisma.printSheetGeneration.deleteMany({ where: { eventId: event.id, id: { not: base.id } } });
    await prisma.printSheetGeneration.update({ where: { id: base.id }, data: { createdById: other.id } });
    const foreign = await post(org.id, event.id, { ids: [a.id, b.id] });
    expect(foreign.status).toBe(201);
    expect((await foreign.json()).export.id).not.toBe(base.id);

    // Termine ou en echec : on en cree un nouveau.
    await prisma.printSheetGeneration.deleteMany({ where: { eventId: event.id } });
    for (const status of ["DONE", "FAILED"] as const) {
      const { export: e } = await (await post(org.id, event.id, { ids: [a.id] })).json();
      await prisma.printSheetGeneration.update({ where: { id: e.id }, data: { status } });
      const next = await post(org.id, event.id, { ids: [a.id] });
      expect(next.status).toBe(201);
      expect((await next.json()).export.id).not.toBe(e.id);
      await prisma.printSheetGeneration.deleteMany({ where: { eventId: event.id } });
    }
  });

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

  it("400 VALIDATION si le corps n'est pas du JSON", async () => {
    const { org, event } = await createBadgeFixtures();
    const res = await POST(
      new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/exports`, {
        method: "POST",
        body: "{pas du json",
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(400);
  });

  it("une erreur inattendue n'est pas masquee en reponse metier", async () => {
    const { org, event, addRegistration } = await createBadgeFixtures();
    const a = await addRegistration();
    const spy = vi.spyOn(prisma.printSheetGeneration, "create").mockRejectedValueOnce(new Error("db HS"));
    await expect(post(org.id, event.id, { ids: [a.id] })).rejects.toThrow("db HS");
    spy.mockRestore();
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

  it("n'expose jamais le message d'erreur interne du worker a l'organisateur", async () => {
    const { org, event, addRegistration } = await createBadgeFixtures();
    const a = await addRegistration();
    const created = await post(org.id, event.id, { ids: [a.id] });
    expect("error" in (await created.json()).export).toBe(false);
    const { export: exp } = await (await post(org.id, event.id, { ids: [a.id] })).json();
    await prisma.printSheetGeneration.update({
      where: { id: exp.id },
      data: { status: "FAILED", error: "S3 AccessDenied bucket=prod-secret PrismaClientKnownRequestError" },
    });
    const res = await get(org.id, event.id, exp.id);
    const body = await res.json();
    expect(body.export.status).toBe("FAILED");
    expect("error" in body.export).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/S3|Prisma|prod-secret/);
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
