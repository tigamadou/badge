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
import { POST } from "@/app/api/org/[orgId]/events/[eventId]/badges/batch/route";

function post(orgId: string, eventId: string, body: unknown) {
  return POST(
    new NextRequest(`http://localhost/api/org/${orgId}/events/${eventId}/badges/batch`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ orgId, eventId }) },
  );
}

describe("POST /api/org/[orgId]/events/[eventId]/badges/batch", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("401 sans session", async () => {
    const { org, event } = await createBadgeFixtures();
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await post(org.id, event.id, { ids: ["x"] })).status).toBe(401);
  });

  it("403 pour un VIEWER sans badge.print", async () => {
    const { org, event, addRegistration } = await createBadgeFixtures({ role: "VIEWER", orgOwner: false });
    const a = await addRegistration();
    expect((await post(org.id, event.id, { ids: [a.id] })).status).toBe(403);
  });

  it("400 VALIDATION si le corps est invalide", async () => {
    const { org, event } = await createBadgeFixtures();
    for (const body of [null, {}, { ids: "a" }, { ids: [1] }, { ids: [""] }]) {
      const res = await post(org.id, event.id, body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "VALIDATION" });
    }
  });

  it("400 VALIDATION si le corps n'est pas du JSON", async () => {
    const { org, event } = await createBadgeFixtures();
    const res = await POST(
      new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/batch`, {
        method: "POST",
        body: "{pas du json",
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(400);
  });

  it("renvoie les approuvees dans l'ordre de la selection, compte les ignorees, sans donnees superflues", async () => {
    // L'autre evenement d'abord : chaque fixture repositionne la session simulee.
    const other = await createBadgeFixtures();
    const foreign = await other.addRegistration();
    const { org, event, category, addRegistration } = await createBadgeFixtures({ role: "PRINTER", orgOwner: false });
    const a = await addRegistration();
    const b = await addRegistration();
    const pending = await addRegistration({ status: "PENDING" });
    await prisma.registration.update({ where: { id: b.id }, data: { badgePrinted: true } });

    const res = await post(org.id, event.id, { ids: [b.id, pending.id, a.id, b.id, "inconnu", foreign.id] });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.badges.map((x: { id: string }) => x.id)).toEqual([b.id, a.id]);
    expect(body.ignored).toBe(3);
    expect(body.badges[0]).toEqual({
      id: b.id,
      label: `${b.snapshotFirstName} ${b.snapshotLastName}`,
      categoryName: category.name,
      categoryColor: category.color,
      printed: true,
    });
    expect(Object.keys(body.badges[1]).sort()).toEqual(["categoryColor", "categoryName", "id", "label", "printed"]);
    expect(JSON.stringify(body)).not.toContain(foreign.id);
  });

  it("masque l'identite d'une categorie anonyme et neutralise la couleur d'un badge neutre", async () => {
    const { org, event, category, addRegistration } = await createBadgeFixtures();
    const a = await addRegistration();
    await prisma.category.update({ where: { id: category.id }, data: { anonymous: true } });
    let body = await (await post(org.id, event.id, { ids: [a.id] })).json();
    expect(body.badges[0].label).toBe("Identité masquée");
    await prisma.category.update({ where: { id: category.id }, data: { anonymous: false, neutralBadge: true } });
    body = await (await post(org.id, event.id, { ids: [a.id] })).json();
    expect(body.badges[0].categoryColor).toBe("#334155");
  });

  it("liste vide : 200 avec rien a imprimer", async () => {
    const { org, event } = await createBadgeFixtures();
    const res = await post(org.id, event.id, { ids: [] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ badges: [], ignored: 0 });
  });

  it("fonctionne sur un evenement archive", async () => {
    const { org, event, addRegistration } = await createBadgeFixtures();
    const a = await addRegistration();
    await prisma.event.update({ where: { id: event.id }, data: { archived: true, archivedAt: new Date() } });
    expect((await post(org.id, event.id, { ids: [a.id] })).status).toBe(200);
  });

  it("5 200 identifiants (plus d'un paquet de lecture) : aucune troncature", async () => {
    const { org, event, category } = await createBadgeFixtures();
    const stamp = Date.now();
    const rows = Array.from({ length: 5200 }, (_, i) => ({ n: i, id: `SEL-${stamp}-${i}` }));
    await prisma.user.createMany({
      data: rows.map((r) => ({ id: `u-${r.id}`, email: `${r.id}@sel.test`, password: "x", name: "B" })),
    });
    await prisma.registration.createMany({
      data: rows.map((r) => ({
        id: r.id,
        eventId: event.id,
        categoryId: category.id,
        userId: `u-${r.id}`,
        snapshotFirstName: "A",
        snapshotLastName: "B",
        snapshotEmail: `${r.id}@sel.test`,
        snapshotStructure: "S",
        snapshotPhoto: "",
        snapshotIdDocumentType: "CNI" as const,
        snapshotIdDocumentNumber: String(r.n),
        snapshotIdDocument: "",
        status: "APPROVED" as const,
      })),
    });
    // L'ordre de la selection est inverse : il doit etre conserve sur toute la liste.
    const ids = rows.map((r) => r.id).reverse();
    const res = await post(org.id, event.id, { ids: [...ids, "inconnu"] });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.badges).toHaveLength(5200);
    expect(body.badges.map((x: { id: string }) => x.id)).toEqual(ids);
    expect(body.ignored).toBe(1);
  }, 120_000);
});
