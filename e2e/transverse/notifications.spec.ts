import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestEventMember,
  createTestRegistration,
  createTestUser,
  disconnectDb,
  getDb,
  getLatestRegistrationForUser,
  makeEventAdminUser,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";
import { loginAs } from "../helpers/auth";
import { mailpit } from "../helpers/mailpit";

// Notifications internes : inscription -> pastille -> panneau -> page -> lien. Les emails
// passent par la queue : le service `worker` doit tourner (cf. e2e/README.md).
test.describe("Transverse — Notifications", () => {
  // La pastille peut mettre jusqu'à 30 s (polling) à se mettre à jour.
  test.setTimeout(120_000);

  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("inscription → pastille → panneau → page → lien de l'inscription", async ({ page, browser }) => {
    const scope = "notif-flow";
    const { orgId, eventId, eventSlug } = await createTestEvent({ scope });
    const admin = await makeEventAdminUser({ scope, eventId, orgId });
    const operator = await createTestEventMember({ scope, eventId, orgId, role: "OPERATOR" });
    const participant = await createTestUser({ scope: `${scope}-part`, verified: true, profile: true });
    await mailpit.clear();

    // Contexte A : l'administrateur est connecté, sans pastille.
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    await expect(page.getByRole("button", { name: /^Notifications$/ })).toBeVisible();

    // Contexte B : le participant s'inscrit par l'interface.
    const participantContext = await browser.newContext();
    const participantPage = await participantContext.newPage();
    await loginAs(participantPage, participant);
    await participantPage.goto(`/e/${eventSlug}`);
    await participantPage.getByRole("link", { name: /s'inscrire à cet événement/i }).click();
    await expect(participantPage).toHaveURL(new RegExp(`/e/${eventSlug}/register`));
    await participantPage.getByRole("radio", { name: /visiteur/i }).check();
    await participantPage.getByRole("checkbox").last().check();
    await participantPage.getByRole("button", { name: /s'inscrire/i }).click();
    await expect(participantPage).toHaveURL(new RegExp(`/e/${eventSlug}/success`), { timeout: 8000 });
    await participantContext.close();

    // Contexte A, sans recharger : la pastille passe à 1 via le polling.
    await expect(page.getByRole("button", { name: "Notifications, 1 non lues" })).toBeVisible({ timeout: 35_000 });

    await page.getByRole("button", { name: "Notifications, 1 non lues" }).click();
    const dialog = page.getByRole("dialog", { name: "Notifications" });
    await expect(dialog.getByText("Nouvelle inscription")).toBeVisible();

    const db = getDb();
    const notification = await db.notification.findFirstOrThrow({ where: { userId: admin.id } });
    await dialog.getByRole("button", { name: /Nouvelle inscription/ }).click();
    await expect(page).toHaveURL(`/event/${eventId}/notifications#n-${notification.id}`);
    const item = page.locator(`#n-${notification.id}`);
    await expect(item).toBeVisible();
    await expect(page.getByRole("button", { name: /^Notifications$/ })).toBeVisible();

    const registration = await getLatestRegistrationForUser(participant.id);
    await item.getByRole("link", { name: `${registration!.snapshotFirstName} ${registration!.snapshotLastName}` }).click();
    await expect(page).toHaveURL(`/event/${eventId}/registrations/${registration!.id}`);

    // Une seule notification par destinataire (l'administrateur est OWNER d'org ET ADMIN).
    expect(await db.notification.count({ where: { userId: admin.id, type: "REGISTRATION_CREATED" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: operator.id, type: "REGISTRATION_CREATED" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: participant.id } })).toBe(0);

    await mailpit.expectMail({ to: admin.email, subjectPattern: /Nouvelle inscription/, timeoutMs: 15_000 });
  });

  test("approbation → le participant voit la notification dans /account, un seul email", async ({ page, browser }) => {
    const scope = "notif-approve";
    const { orgId, eventId, categoryId } = await createTestEvent({ scope });
    const admin = await makeEventAdminUser({ scope, eventId, orgId });
    const participant = await createTestUser({ scope: `${scope}-part`, verified: true, profile: true });
    const reg = await createTestRegistration({ eventId, userId: participant.id, categoryId, status: "PENDING" });
    await mailpit.clear();

    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
    await expect(page).toHaveURL(`/event/${eventId}/registrations/${reg.id}`);
    await page.getByRole("button", { name: /^approuver$/i }).click();
    await expect
      .poll(async () => (await getDb().registration.findUnique({ where: { id: reg.id } }))?.status, {
        timeout: 10_000,
      })
      .toBe("APPROVED");

    const participantContext = await browser.newContext();
    const participantPage = await participantContext.newPage();
    await loginAs(participantPage, participant);
    await expect(participantPage).toHaveURL(/\/account/);
    const bell = participantPage.getByRole("button", { name: "Notifications, 1 non lues" });
    await expect(bell).toBeVisible({ timeout: 35_000 });
    await bell.click();
    await expect(
      participantPage.getByRole("dialog", { name: "Notifications" }).getByText("Inscription approuvée"),
    ).toBeVisible();
    await participantContext.close();

    await mailpit.expectMail({ to: participant.email, subjectPattern: /est approuvée/, timeoutMs: 15_000 });
    const mails = await mailpit.search({ to: participant.email });
    expect(mails).toHaveLength(1);
    expect(mails[0].Subject).toMatch(/est approuvée/);
  });

  test("à 375 px, le panneau s'ouvre en plein écran et se ferme par Échap", async ({ page }) => {
    const scope = "notif-mobile";
    const { orgId, eventId } = await createTestEvent({ scope });
    const admin = await makeEventAdminUser({ scope, eventId, orgId });
    await getDb().notification.create({
      data: {
        userId: admin.id,
        type: "EVENT_REGISTRATION_OPENED",
        scope: "EVENT",
        orgId,
        eventId,
        title: "Inscriptions ouvertes",
        body: "Les inscriptions sont ouvertes.",
        href: `/event/${eventId}`,
        links: [{ label: "Ouvrir l'évènement", href: `/event/${eventId}` }],
      },
    });

    await page.setViewportSize({ width: 375, height: 812 });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    await page.getByRole("button", { name: "Notifications, 1 non lues" }).click();

    const dialog = page.getByRole("dialog", { name: "Notifications" });
    await expect(dialog.getByText("Inscriptions ouvertes")).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box!.width)).toBe(375);
    expect(Math.round(box!.height)).toBe(812);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}$`));
  });
});
