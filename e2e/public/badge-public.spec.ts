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

  test("/badge/[id] download flow", async () => {
    // La page /badge/[id] (src/app/badge/[id]/page.tsx) fait un fetch vers
    // /api/verify/[id] qui N'EXISTE PAS dans le code v2 actuel (cf src/app/api/
    // -- seule /api/public/verify/[badgeId] existe). La page est cassee et reste
    // bloquee sur "Chargement..." en attendant la response 404.
    //
    // Le PDF du badge est genere cote admin via
    // /api/org/[orgId]/events/[eventId]/badges/[id] et requiert une session
    // EventMember PRINTER/ADMIN. Pour un participant, il n'existe pas de route
    // publique de download de badge en v2 actuellement.
    //
    // Ce test est skippe en attendant : (a) une route /api/verify/[id] cote
    // public OU (b) une route /api/account/registrations/[id]/badge cote
    // participant.
    test.skip(
      true,
      "/badge/[id] casse : appelle /api/verify/[id] qui n'existe pas (v2 bug). Voir specs section 5.",
    );
  });
});
