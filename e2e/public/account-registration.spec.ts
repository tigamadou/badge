import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestUser,
  createTestEvent,
  createTestRegistration,
  createTestCategory,
  getLatestRegistrationForUser,
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
    await expect(page.getByText("Inscription resoumise.")).toBeVisible();

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

  test("le participant change de catégorie en resoumettant une inscription rejetée", async ({
    page,
  }) => {
    const user = await createTestUser({ scope: "resubmit-cat", verified: true, profile: true });
    const { eventId, categoryId } = await createTestEvent({ scope: "resubmit-cat" });
    const exposantName = `Exposant-${Date.now()}`;
    await createTestCategory({ eventId, name: exposantName, number: 2 });
    const { id: regId } = await createTestRegistration({
      userId: user.id,
      eventId,
      categoryId,
      status: "PENDING",
    });
    await rejectRegistration(regId, "Mauvaise catégorie");
    await mailpit.clear();

    await loginAs(page, user);
    await page.goto(`/account/registrations/${regId}`);
    await expect(page.getByText(/mauvaise catégorie/i)).toBeVisible();
    await expect(page.getByRole("radio", { name: /Visiteur/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await page.getByRole("radio", { name: /Exposant/ }).click();
    await expect(page.getByText(/sera resoumise dans la catégorie/i)).toBeVisible();

    await page.getByRole("button", { name: /resoumettre mon inscription/i }).click();
    await page.waitForURL(
      (u) => u.pathname.startsWith("/account/registrations/") && !u.pathname.endsWith(regId),
    );

    const latest = await getLatestRegistrationForUser(user.id);
    const newId = latest!.id;
    expect(latest?.status).toBe("PENDING");
    expect(newId).not.toBe(regId);
    expect(newId[0]).toBe("2");
    expect(await getDb().registration.findUnique({ where: { id: regId } })).toBeNull();
    const moved = await getDb().registration.findUnique({
      where: { id: newId },
      select: { category: { select: { name: true } } },
    });
    expect(moved?.category.name).toBe(exposantName);

    await expect(page.getByText(exposantName).first()).toBeVisible();

    // L'ancienne URL n'existe plus (le projet n'a pas de not-found.tsx : 404 Next par defaut).
    const resp = await page.goto(`/account/registrations/${regId}`);
    expect(resp?.status()).toBe(404);

    await expectLastActivity({
      type: "REGISTRATION_RESUBMITTED",
      userId: user.id,
      eventId,
      targetId: newId,
    });
    // Suppose que le worker de la queue d'emails tourne en dev.
    await mailpit.expectMail({
      to: user.email,
      subjectPattern: /resoumise/i,
      bodyPattern: /Exposant-/,
      timeoutMs: 8000,
    });
  });

  test("affiche l'erreur de l'API dans un toast quand l'inscription n'est plus rejetée", async ({
    page,
  }) => {
    const user = await createTestUser({ scope: "resubmit-409", verified: true, profile: true });
    const { eventId, categoryId } = await createTestEvent({ scope: "resubmit-409" });
    const { id: regId } = await createTestRegistration({
      userId: user.id,
      eventId,
      categoryId,
      status: "PENDING",
    });
    await rejectRegistration(regId, "Photo illisible");

    await loginAs(page, user);
    await page.goto(`/account/registrations/${regId}`);
    const button = page.getByRole("button", { name: /resoumettre mon inscription/i });
    await expect(button).toBeVisible();

    // La page affiche encore le bouton alors que l'inscription n'est plus rejetée.
    await setRegistrationStatus(regId, "PENDING");
    await button.click();

    await expect(
      page.getByText("Seules les inscriptions rejetées peuvent être resoumises."),
    ).toBeVisible();
    const reg = await getDb().registration.findUnique({
      where: { id: regId },
      select: { status: true },
    });
    expect(reg?.status).toBe("PENDING");
  });

  test("un double clic n'envoie qu'une requête", async ({ page }) => {
    const user = await createTestUser({ scope: "resubmit-dbl", verified: true, profile: true });
    const { eventId, categoryId } = await createTestEvent({ scope: "resubmit-dbl" });
    const { id: regId } = await createTestRegistration({
      userId: user.id,
      eventId,
      categoryId,
      status: "PENDING",
    });
    await rejectRegistration(regId, "Photo illisible");

    await loginAs(page, user);
    await page.goto(`/account/registrations/${regId}`);
    let posts = 0;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/resubmit")) posts += 1;
    });

    await page.getByRole("button", { name: /resoumettre mon inscription/i }).dblclick();
    await expect(page.getByText("Inscription resoumise.")).toBeVisible();
    expect(posts).toBe(1);
  });

  test("le detail affiche le bloc Pieces fournies avec les apercus", async ({ page }) => {
    const user = await createTestUser({ scope: "reg-pieces", verified: true, profile: true });
    const { eventId, categoryId } = await createTestEvent({ scope: "reg-pieces" });
    const { id: regId } = await createTestRegistration({
      userId: user.id,
      eventId,
      categoryId,
      status: "PENDING",
    });

    await loginAs(page, user);
    await page.goto(`/account/registrations/${regId}`);
    await expect(page).toHaveURL(new RegExp(`/account/registrations/${regId}$`));
    await expect(page.getByText(/pièces fournies/i)).toBeVisible();
    // Chaque piece fournie est un apercu cliquable (DocumentPreview).
    await expect(page.getByText(/cliquer pour agrandir/i)).toHaveCount(2);
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
    await page.goto(`/account/registrations/${regId}`);
    await page.getByRole("button", { name: /resoumettre mon inscription/i }).click();
    await page.waitForTimeout(1500);

    await expectLastActivity({
      type: "REGISTRATION_RESUBMITTED",
      userId: user.id,
      eventId,
      targetId: regId,
    });
  });

  // --- QR d'accueil (plan 35) -----------------------------------------------

  test("une inscription approuvée affiche la carte « QR d'accueil » avec son ID", async ({ page }) => {
    const user = await createTestUser({ scope: "welcome-qr", verified: true, profile: true });
    const { eventId, categoryId } = await createTestEvent({ scope: "welcome-qr" });
    const { id: regId } = await createTestRegistration({
      userId: user.id,
      eventId,
      categoryId,
      status: "APPROVED",
    });

    await loginAs(page, user);
    await page.goto(`/account/registrations/${regId}`);
    await expect(page).toHaveURL(new RegExp(`/account/registrations/${regId}$`));
    await expect(page.getByText("QR d'accueil", { exact: true })).toBeVisible();
    const qr = page.getByRole("img", { name: "QR d'accueil" });
    await expect(qr).toBeVisible();
    await expect(qr).toHaveAttribute("src", /^data:image\//);
    await expect(page.getByText(regId, { exact: true })).toBeVisible();
    await expect(page.getByText("À présenter à l'accueil, sur votre téléphone ou imprimé.")).toBeVisible();
  });

  test("une inscription en attente ou rejetée n'affiche pas de QR d'accueil", async ({ page }) => {
    const user = await createTestUser({ scope: "welcome-qr-none", verified: true, profile: true });
    const { eventId, categoryId } = await createTestEvent({ scope: "welcome-qr-none" });
    const { id: regId } = await createTestRegistration({
      userId: user.id,
      eventId,
      categoryId,
      status: "PENDING",
    });

    await loginAs(page, user);
    await page.goto(`/account/registrations/${regId}`);
    await expect(page).toHaveURL(new RegExp(`/account/registrations/${regId}$`));
    await expect(page.getByRole("heading", { name: "Salon E2E" })).toBeVisible();
    await expect(page.getByRole("img", { name: "QR d'accueil" })).toHaveCount(0);
    await expect(page.getByText("QR d'accueil", { exact: true })).toHaveCount(0);
  });

  // --- Gardes -------------------------------------------------------------

});
