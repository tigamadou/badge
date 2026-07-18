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

  test("logged-in user with complete profile can register to an event", async ({ page }) => {
    const user = await createTestUser({ scope: "evt-flow", verified: true, profile: true });
    const { eventSlug } = await createTestEvent({ scope: "evt-flow" });
    await loginAs(page, user);

    await page.goto(`/e/${eventSlug}`);
    await page.getByRole("link", { name: /s'inscrire à cet événement/i }).click();

    await expect(page).toHaveURL(new RegExp(`/e/${eventSlug}/register`));
    await page.getByLabel(/visiteur/i).check();
    await page.getByRole("checkbox").last().check();
    await page.getByRole("button", { name: /valider mon inscription/i }).click();

    await page.waitForURL(new RegExp(`/e/${eventSlug}/success`), { timeout: 8000 });
    await expect(page.getByText(/votre inscription a bien été enregistrée/i)).toBeVisible();

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

    // API : POST /api/events/[slug]/register renvoie 403 (CLOSED).
    const res = await page.request.post(`/api/events/${eventSlug}/register`, {
      data: { categoryId: "anything" },
    });
    expect([403, 409]).toContain(res.status());
  });

  test("BlockedEmail blocks event registration", async ({ page }) => {
    const user = await createTestUser({ scope: "evt-blocked", verified: true, profile: true });
    const { eventId, eventSlug, categoryId } = await createTestEvent({ scope: "evt-blocked" });
    await createTestBlockedEmail({ eventId, email: user.email });
    await loginAs(page, user);

    // Appel API direct : le snapshot prend l'email du User, qui est blocke -> 409 EMAIL_BLOCKED.
    const res = await page.request.post(`/api/events/${eventSlug}/register`, {
      data: { categoryId },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("EMAIL_BLOCKED");
  });

  test("plan participant limit enforced per event (429 PARTICIPANT_LIMIT)", async ({ page }) => {
    // On cree un event dont le plan limite a 1 participant/event puis on tente 2
    // registrations. La 2e doit echouer (429, cf assertCanRegister).
    const { eventId, eventSlug, categoryId } = await createTestEvent({ scope: "evt-quota" });
    await getDb().plan.updateMany({
      where: { subscriptions: { some: { org: { events: { some: { id: eventId } } } } } },
      data: { maxParticipantsPerEvent: 1 },
    });

    // Premier user OK (PENDING compte dans le quota).
    const firstUser = await createTestUser({
      scope: "evt-quota-1",
      verified: true,
      profile: true,
    });
    await createTestRegistration({
      userId: firstUser.id,
      eventId,
      categoryId,
      status: "PENDING",
    });

    // 2e user tente l'inscription via l'API : doit etre rejete (quota atteint).
    const secondUser = await createTestUser({
      scope: "evt-quota-2",
      verified: true,
      profile: true,
    });
    await loginAs(page, secondUser);

    const res = await page.request.post(`/api/events/${eventSlug}/register`, {
      data: { categoryId },
    });
    expect(res.status()).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("PARTICIPANT_LIMIT");
  });
});
