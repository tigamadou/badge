import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import {
  cleanupE2ETestData,
  createTestUser,
  createTestEvent,
  rejectRegistration,
  disconnectDb,
} from "./helpers/db";

const prisma = new PrismaClient();

test.describe("Account resubmit after rejection", () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("user can resubmit a rejected registration from /account/registrations/[id]", async ({ page }) => {
    const user = await createTestUser({ scope: "resubmit", verified: true, profile: true });
    const { eventId, categoryId } = await createTestEvent({ scope: "resubmit" });

    // Seed une registration directement (sans passer par l'API : plus rapide et
    // moins fragile pour le test resubmit). Le snapshot reflete le profil v2-11.
    const reg = await prisma.registration.create({
      data: {
        id: `E2E-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        userId: user.id,
        eventId,
        categoryId,
        snapshotFirstName: "Awa",
        snapshotLastName: "Diallo",
        snapshotEmail: user.email,
        snapshotStructure: "ENSEA",
        snapshotPhoto: "uploads/profile/e2e/awa-photo.jpg",
        snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: "CI-E2E-001",
        snapshotIdDocument: "uploads/profile/e2e/awa-cni.pdf",
        status: "PENDING",
      },
    });
    await rejectRegistration(reg.id, "Photo illisible");

    // Login
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Mot de passe").fill(user.password);
    await page.getByRole("button", { name: /se connecter/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 8000 });

    // Va sur le detail de la registration
    await page.goto(`/account/registrations/${reg.id}`);
    await expect(page.getByText(/rejetée/i).first()).toBeVisible();
    await expect(page.getByText(/photo illisible/i)).toBeVisible();

    // Clique sur le bouton resubmit
    await page.getByRole("button", { name: /resoumettre mon inscription/i }).click();

    // Apres resubmit, le status devient PENDING -- la page se refresh
    await page.waitForTimeout(1500);
    const updated = await prisma.registration.findUnique({
      where: { id: reg.id },
      select: { status: true, rejectionReason: true },
    });
    expect(updated?.status).toBe("PENDING");
    expect(updated?.rejectionReason).toBeNull();
  });
});
