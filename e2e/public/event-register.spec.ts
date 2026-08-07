import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestUser,
  createTestEvent,
  createTestRegistration,
  createTestBlockedEmail,
  getLatestRegistrationForUser,
  getDb,
  disconnectDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";

test.describe("Event registration flow", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("public event page shows login/register CTA when not logged in", async ({ page }) => {
    const { eventSlug } = await createTestEvent({ scope: "public-cta" });

    await page.goto(`/e/${eventSlug}`);
    await expect(page.getByText(/se connecter pour s'inscrire/i)).toBeVisible();
    await expect(page.getByText(/créer un compte/i)).toBeVisible();
  });

  test("la page publique affiche la periode, le lieu et la description", async ({ page }) => {
    const { eventSlug } = await createTestEvent({
      scope: "event-details",
      date: new Date("2026-12-15T00:00:00Z"),
      endDate: new Date("2026-12-17T00:00:00Z"),
      description: "Trois jours de conferences.",
    });

    await page.goto(`/e/${eventSlug}`);
    await expect(page).toHaveURL(new RegExp(`/e/${eventSlug}$`));
    await expect(page.getByText(/Du 15 Décembre . 2026 au 17 Décembre . 2026/).first()).toBeVisible();
    await expect(page.getByText("Trois jours de conferences.")).toBeVisible();
  });

  test("logged-in user with complete profile can register to an event", async ({ page }) => {
    const user = await createTestUser({ scope: "evt-flow", verified: true, profile: true });
    const { eventSlug } = await createTestEvent({ scope: "evt-flow" });
    await loginAs(page, user);

    await page.goto(`/e/${eventSlug}`);
    await page.getByRole("link", { name: /s'inscrire à cet événement/i }).click();

    await expect(page).toHaveURL(new RegExp(`/e/${eventSlug}/register`));
    await page.getByRole("radio", { name: /visiteur/i }).check();
    await page.getByRole("checkbox").last().check();
    await page.getByRole("button", { name: /s'inscrire/i }).click();

    await page.waitForURL(new RegExp(`/e/${eventSlug}/success`), { timeout: 8000 });
    await expect(page.getByRole("heading", { name: /inscription enregistrée/i })).toBeVisible();

    const reg = await getLatestRegistrationForUser(user.id);
    expect(reg).not.toBeNull();
    expect(reg?.status).toBe("PENDING");
    expect(reg?.snapshotFirstName).toBe("Awa");
  });

  test("user with incomplete profile is redirected to /account/profile/complete", async ({
    page,
  }) => {
    const user = await createTestUser({ scope: "evt-incomplete", verified: true, profile: false });
    const { eventSlug } = await createTestEvent({ scope: "evt-incomplete" });
    await loginAs(page, user);

    await page.goto(`/e/${eventSlug}/register`);
    await page.waitForURL(/\/account\/profile\/complete/, { timeout: 8000 });
    await expect(page.getByRole("heading", { name: /compléter votre profil/i })).toBeVisible();
  });

  test("already registered user sees notice + link to detail", async ({ page }) => {
    const user = await createTestUser({
      scope: "evt-already",
      verified: true,
      profile: true,
    });
    const { eventId, eventSlug, categoryId } = await createTestEvent({ scope: "evt-already" });
    const { id: regId } = await createTestRegistration({
      userId: user.id,
      eventId,
      categoryId,
      status: "PENDING",
    });
    await loginAs(page, user);

    await page.goto(`/e/${eventSlug}/register`);
    await expect(page.getByText(/déjà inscrit à cet événement/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /voir le détail de mon inscription/i }),
    ).toHaveAttribute("href", `/account/registrations/${regId}`);
  });

  test("archived event closes public page and refuses API register", async ({ page }) => {
    const user = await createTestUser({ scope: "evt-archived", verified: true, profile: true });
    const { eventId, eventSlug } = await createTestEvent({ scope: "evt-archived" });
    await getDb().event.update({
      where: { id: eventId },
      data: { archived: true, archivedAt: new Date() },
    });
    await loginAs(page, user);

    // UI : page publique affiche "Inscriptions fermées".
    await page.goto(`/e/${eventSlug}`);
    await expect(page.getByText(/inscriptions fermées/i)).toBeVisible();
  });

  test("Un e-mail bloque empeche l'inscription (echec via le formulaire)", async ({ page }) => {
    const user = await createTestUser({ scope: "evt-blocked", verified: true, profile: true });
    const { eventId, eventSlug } = await createTestEvent({ scope: "evt-blocked" });
    await createTestBlockedEmail({ eventId, email: user.email });
    await loginAs(page, user);

    await page.goto(`/e/${eventSlug}/register`);
    await page.getByRole("radio", { name: /visiteur/i }).check();
    await page.getByRole("checkbox").last().check();
    await page.getByRole("button", { name: /s'inscrire/i }).click();

    // Reponse attendue — ECHEC : reste sur /register (pas de succes), aucune inscription creee.
    await expect(page).toHaveURL(new RegExp(`/e/${eventSlug}/register`));
    await expect(page.getByRole("button", { name: /s'inscrire/i })).toBeVisible();
    expect(await getLatestRegistrationForUser(user.id)).toBeNull();
  });

  // --- Page de succes -----------------------------------------------------

  test("La page de succes confirme l'inscription", async ({ page }) => {
    const { eventSlug, eventId, categoryId } = await createTestEvent({ scope: "evreg-success" });
    const user = await createTestUser({
      scope: "evreg-success-u",
      verified: true,
      profile: true,
    });
    const reg = await createTestRegistration({
      eventId,
      userId: user.id,
      categoryId,
      status: "PENDING",
    });
    await loginAs(page, user);

    await page.goto(`/e/${eventSlug}/success?id=${reg.id}`);
    await expect(page.getByRole("heading", { name: /inscription enregistrée/i })).toBeVisible();
    await expect(page.getByText(/statut : en attente/i)).toBeVisible();
  });

});
