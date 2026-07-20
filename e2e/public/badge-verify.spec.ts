import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestUser,
  createTestEvent,
  createTestCategory,
  createTestRegistration,
  getDb,
  disconnectDb,
} from "../helpers/db";
import { expectLastActivity } from "../helpers/audit";

// Marque la registration comme "badge imprime" pour la considerer valide par
// /verify/[badgeId] (cf src/app/verify/[badgeId]/page.tsx:22 et l'API
// src/app/api/public/verify/[badgeId]/route.ts:24 : valid = APPROVED && badgePrinted).
async function markBadgePrinted(regId: string): Promise<void> {
  await getDb().registration.update({
    where: { id: regId },
    data: { badgePrinted: true, badgePrintedAt: new Date() },
  });
}

test.describe("Badge public verify + download", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("/verify/[badgeId] APPROVED non-anonymous shows name + structure", async ({ page }) => {
    const user = await createTestUser({ scope: "verify-ok", verified: true, profile: true });
    const { eventId, categoryId } = await createTestEvent({ scope: "verify-ok" });
    const { id: regId } = await createTestRegistration({
      userId: user.id,
      eventId,
      categoryId,
      status: "APPROVED",
    });
    await markBadgePrinted(regId);

    await page.goto(`/verify/${regId}`);
    await expect(page.getByText(/badge valide/i)).toBeVisible();
    await expect(page.getByText(/awa\s+diallo/i)).toBeVisible();
    await expect(page.getByText(/ensea/i)).toBeVisible();
    await expect(page.getByText(/salon e2e/i)).toBeVisible();
  });

  test("/verify/[badgeId] APPROVED anonymous masks participant identity", async ({
    page,
  }) => {
    const user = await createTestUser({ scope: "verify-anon", verified: true, profile: true });
    const { eventId } = await createTestEvent({ scope: "verify-anon" });
    const { id: catId } = await createTestCategory({
      eventId,
      name: "Anonyme",
      anonymous: true,
    });
    const { id: regId } = await createTestRegistration({
      userId: user.id,
      eventId,
      categoryId: catId,
      status: "APPROVED",
    });
    await markBadgePrinted(regId);

    await page.goto(`/verify/${regId}`);
    await expect(page.getByText(/badge valide/i)).toBeVisible();
    // Le nom du participant est masque pour les categories anonymes.
    await expect(page.getByText(/awa\s+diallo/i)).toHaveCount(0);
  });

  test("/verify/[badgeId] PENDING is shown as invalid", async ({ page }) => {
    const user = await createTestUser({
      scope: "verify-pending",
      verified: true,
      profile: true,
    });
    const { eventId, categoryId } = await createTestEvent({ scope: "verify-pending" });
    const { id: regId } = await createTestRegistration({
      userId: user.id,
      eventId,
      categoryId,
      status: "PENDING",
    });

    await page.goto(`/verify/${regId}`);
    await expect(page.getByText(/badge non valide/i)).toBeVisible();
  });

  test("/verify/[badgeId] for unknown id returns 404 page", async ({ page }) => {
    const response = await page.goto(`/verify/does-not-exist-${Date.now()}`);
    // notFound() renvoie un statut 404 ; Next.js sert la page 404.
    expect(response?.status()).toBe(404);
  });

  test("public verify API logs BADGE_SCANNED activity on each call", async ({ page }) => {
    // La page /verify/[badgeId] NE log PAS d'audit (cf src/app/verify/[badgeId]/page.tsx
    // qui fait une lecture directe Prisma). Seul l'endpoint API
    // /api/public/verify/[badgeId] log BADGE_SCANNED. On scan via l'API publique
    // pour valider l'audit (c'est la voie utilisee par le scan QR mobile).
    const user = await createTestUser({ scope: "verify-audit", verified: true, profile: true });
    const { eventId, categoryId } = await createTestEvent({ scope: "verify-audit" });
    const { id: regId } = await createTestRegistration({
      userId: user.id,
      eventId,
      categoryId,
      status: "APPROVED",
    });
    await markBadgePrinted(regId);

    const res = await page.request.get(`/api/public/verify/${regId}`);
    expect(res.status()).toBe(200);

    await expectLastActivity({
      type: "BADGE_SCANNED",
      eventId,
      targetId: regId,
    });
  });

  // La page publique /badge/[id] a ete SUPPRIMEE (ilot v1 orphelin : sa route
  // data /api/verify/[id] avait disparu au nettoyage v2 et aucun lien n'y menait ;
  // le QR pointe vers /verify/[badgeId], couvert ci-dessus). Le PDF du badge est
  // genere cote espace evenement (/api/org/.../badges/[badgeId], permission
  // badge.print). Aucun flux public de telechargement n'existe donc plus.
});
