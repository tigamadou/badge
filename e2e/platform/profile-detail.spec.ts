import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  disconnectDb,
  getDb,
  createTestUser,
  createTestProfileSubmission,
  createTestRejectionReason,
} from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";

// Page Detail profil — /platform/profiles/[userId]
// Decision par STAFF_SUPPORT+ : approbation, rejet avec motif catalogue.
test.describe("Platform — Profil (detail)", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("STAFF_SUPPORT approuve un profil (statut + audit)", async ({ page }) => {
    const participant = await createTestUser({ scope: "prof-approve", verified: true, profile: true, profileStatus: "PENDING" });
    await createTestProfileSubmission({ userId: participant.id, status: "PENDING" });
    const staff = await loginAsStaff(page, { role: "STAFF_SUPPORT", scope: "prof-approve" });

    await page.goto(`/platform/profiles/${participant.id}`);
    await expect(page).toHaveURL(new RegExp(`/platform/profiles/${participant.id}$`));
    await expect(page.getByText(/historique des soumissions/i)).toBeVisible();
    await page.getByRole("button", { name: /approuver/i }).click();

    await expect(async () => {
      const fresh = await getDb().user.findUnique({ where: { id: participant.id } });
      expect(fresh?.profileStatus).toBe("APPROVED");
    }).toPass();
    await expectLastActivity({ type: "PROFILE_APPROVED", userId: staff.id, targetId: participant.id });
  });

  test("STAFF_SUPPORT rejette avec un motif du catalogue", async ({ page }) => {
    const participant = await createTestUser({ scope: "prof-reject", verified: true, profile: true, profileStatus: "PENDING" });
    await createTestProfileSubmission({ userId: participant.id, status: "PENDING" });
    const reason = await createTestRejectionReason({ scope: "PROFILE", label: `E2E motif reject ${Date.now()}` });
    await loginAsStaff(page, { role: "STAFF_SUPPORT", scope: "prof-reject" });

    await page.goto(`/platform/profiles/${participant.id}`);
    await page.getByRole("button", { name: /^rejeter$/i }).click();
    await page.getByLabel(/motif de rejet/i).selectOption(reason.id);
    await page.getByRole("button", { name: /confirmer le rejet/i }).click();

    await expect(async () => {
      const fresh = await getDb().user.findUnique({ where: { id: participant.id } });
      expect(fresh?.profileStatus).toBe("REJECTED");
      const sub = await getDb().profileSubmission.findFirst({
        where: { userId: participant.id },
        orderBy: { createdAt: "desc" },
      });
      expect(sub?.rejectionReasonLabel).toBe(reason.label);
    }).toPass();
  });

  test("STAFF_OBSERVER ne voit pas les boutons de decision", async ({ page }) => {
    const participant = await createTestUser({ scope: "prof-observer", verified: true, profile: true, profileStatus: "PENDING" });
    await createTestProfileSubmission({ userId: participant.id, status: "PENDING" });
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "prof-observer" });

    await page.goto(`/platform/profiles/${participant.id}`);
    // La lecture est autorisee, mais l'approbation/rejet sont reserves STAFF_SUPPORT+.
    // L'UI masque les actions ; la garde serveur (403) est asseree en integration.
    await expect(page.getByRole("button", { name: /^approuver$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^rejeter$/i })).toHaveCount(0);
  });
});
