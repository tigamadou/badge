import { test, expect } from "@playwright/test";
import { createTestStaff, cleanupE2ETestData, disconnectDb } from "../helpers/db";
import { loginAs } from "../helpers/auth";

test.describe("Parcours abonnement org", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("creation org : slug genere en direct et en lecture seule", async ({ page }) => {
    const staff = await createTestStaff({ scope: "slug-live", role: "STAFF_ADMIN" });
    await loginAs(page, staff);

    await page.goto("/platform/organizations/new");
    const slugField = page.getByLabel(/Slug/);

    // Le slug suit le nom en direct.
    await page.getByLabel("Nom de l'organisation").fill("Salon Emploi E2E");
    await expect(slugField).toHaveValue("salon-emploi-e2e");

    // Accents et ponctuation normalises.
    await page.getByLabel("Nom de l'organisation").fill("Évènement Été !!");
    await expect(slugField).toHaveValue("evenement-ete");

    // Lecture seule : non editable.
    await expect(slugField).toHaveAttribute("readonly", "");
  });
});
