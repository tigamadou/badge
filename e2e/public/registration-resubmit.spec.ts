import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestUser,
  createTestEvent,
  createTestRegistration,
  rejectRegistration,
  setRegistrationStatus,
  getDb,
  disconnectDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { mailpit } from "../helpers/mailpit";
import { expectLastActivity } from "../helpers/audit";

test.describe("Account resubmit after rejection", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("user can resubmit a rejected registration from /account/registrations/[id]", async ({
    page,
  }) => {
    const user = await createTestUser({ scope: "resubmit", verified: true, profile: true });
    const { eventId, categoryId } = await createTestEvent({ scope: "resubmit" });
    const { id: regId } = await createTestRegistration({
      userId: user.id,
      eventId,
      categoryId,
      status: "PENDING",
    });
    await rejectRegistration(regId, "Photo illisible");

    await loginAs(page, user);
    await page.goto(`/account/registrations/${regId}`);
    await expect(page.getByText(/rejetée/i).first()).toBeVisible();
    await expect(page.getByText(/photo illisible/i)).toBeVisible();

    await page.getByRole("button", { name: /resoumettre mon inscription/i }).click();

    // Apres resubmit le client appelle router.refresh ; on lit la BDD apres
    // un court delai.
    await page.waitForTimeout(1500);
    const updated = await getDb().registration.findUnique({
      where: { id: regId },
      select: { status: true, rejectionReason: true },
    });
    expect(updated?.status).toBe("PENDING");
    expect(updated?.rejectionReason).toBeNull();
  });

  test("resubmit triggers email with subject 'Inscription resoumise'", async ({ page }) => {
    const user = await createTestUser({ scope: "resubmit-mail", verified: true, profile: true });
    const { eventId, categoryId } = await createTestEvent({ scope: "resubmit-mail" });
    const { id: regId } = await createTestRegistration({
      userId: user.id,
      eventId,
      categoryId,
      status: "PENDING",
    });
    await rejectRegistration(regId, "Document flou");

    await mailpit.clear();
    await loginAs(page, user);
    await page.goto(`/account/registrations/${regId}`);
    await page.getByRole("button", { name: /resoumettre mon inscription/i }).click();

    // Le mail est envoye via sendRegistrationResubmitted -> subject contient
    // "Inscription resoumise — <event>". Le snapshot Email est celui du user (par
    // defaut user.email puisque le user a un profil complet).
    await mailpit.expectMail({
      to: user.email,
      subjectPattern: /resoumise/i,
      timeoutMs: 8000,
    });
  });

  test("profile edit before resubmit updates the snapshot", async ({ page }) => {
    const user = await createTestUser({ scope: "resubmit-cycle", verified: true, profile: true });
    const { eventId, categoryId } = await createTestEvent({ scope: "resubmit-cycle" });
    const { id: regId } = await createTestRegistration({
      userId: user.id,
      eventId,
      categoryId,
      status: "PENDING",
    });
    await rejectRegistration(regId, "Erreur prenom");

    await loginAs(page, user);

    // Modifie le profil (changement firstName) avant resubmit.
    await page.goto("/account/profile");
    await page.getByLabel("Prénom").fill("Awatif");
    await page.getByRole("button", { name: /enregistrer/i }).click();
    await page.waitForTimeout(800);

    // Resubmit
    await page.goto(`/account/registrations/${regId}`);
    await page.getByRole("button", { name: /resoumettre mon inscription/i }).click();
    await page.waitForTimeout(1500);

    // Le snapshot reflete la nouvelle valeur.
    const reg = await getDb().registration.findUnique({
      where: { id: regId },
      select: { snapshotFirstName: true, status: true },
    });
    expect(reg?.status).toBe("PENDING");
    expect(reg?.snapshotFirstName).toBe("Awatif");
  });

  test("resubmit on PENDING is refused with 409 INVALID_STATE", async ({ page }) => {
    const user = await createTestUser({
      scope: "resubmit-bad-state",
      verified: true,
      profile: true,
    });
    const { eventId, categoryId } = await createTestEvent({ scope: "resubmit-bad-state" });
    const { id: regId } = await createTestRegistration({
      userId: user.id,
      eventId,
      categoryId,
      status: "PENDING",
    });
    // Force PENDING explicitement (deja le defaut, mais on est explicite).
    await setRegistrationStatus(regId, "PENDING");

    await loginAs(page, user);
    const res = await page.request.post(
      `/api/account/registrations/${regId}/resubmit`,
    );
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("INVALID_STATE");
  });

  test("audit REGISTRATION_RESUBMITTED is logged with eventId + targetId", async ({ page }) => {
    const user = await createTestUser({
      scope: "resubmit-audit",
      verified: true,
      profile: true,
    });
    const { eventId, categoryId } = await createTestEvent({ scope: "resubmit-audit" });
    const { id: regId } = await createTestRegistration({
      userId: user.id,
      eventId,
      categoryId,
      status: "PENDING",
    });
    await rejectRegistration(regId, "Audit test");

    await loginAs(page, user);
    const res = await page.request.post(
      `/api/account/registrations/${regId}/resubmit`,
    );
    expect(res.status()).toBe(200);

    await expectLastActivity({
      type: "REGISTRATION_RESUBMITTED",
      userId: user.id,
      eventId,
      targetId: regId,
    });
  });
});
