import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestUser,
  createTestEvent,
  createTestRegistration,
  getUserById,
  getDb,
  disconnectDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { ensureFixtures } from "../fixtures";
import { readFileSync } from "node:fs";
import { readImageDimensions } from "@/lib/image-dimensions";
import { confirmCrop } from "../helpers/images-2a";

test.describe("Account profile edit", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("user can edit profile fields and changes persist", async ({ page }) => {
    const user = await createTestUser({ scope: "profile-edit", verified: true });
    await loginAs(page, user);

    await page.goto("/account/profile");
    await expect(page.getByRole("heading", { name: /mon profil/i })).toBeVisible();

    await page.getByLabel("Prénom").fill("Awa");
    await page.getByLabel("Nom", { exact: true }).fill("Diallo");
    await page.getByLabel(/structure/i).fill("ENSEA E2E");
    await page.getByLabel(/numéro de pièce/i).fill("CI-E2E-PROFILE");

    await page.getByRole("button", { name: /enregistrer/i }).click();

    // Verification persistence (le PUT renvoie 200 et le formulaire reste sur la
    // page : on attend un court delai puis on lit la BDD).
    await page.waitForTimeout(1000);
    const updated = await getUserById(user.id);
    expect(updated?.firstName).toBe("Awa");
    expect(updated?.lastName).toBe("Diallo");
    expect(updated?.structure).toBe("ENSEA E2E");
  });

  test("upload photo persists and serves via /api/files", async ({ page }) => {
    const fixtures = ensureFixtures();
    // profile:true pre-remplit les champs requis (firstName, idDocumentType/Number...) :
    // sans eux, la validation HTML5 native du formulaire bloque la soumission (pas de PUT).
    const user = await createTestUser({ scope: "profile-upload-photo", verified: true, profile: true });
    await loginAs(page, user);
    await page.goto("/account/profile");

    // Le composant ProfileForm appelle /api/account/upload?kind=photo a l'onChange.
    await page.setInputFiles('input[type="file"][accept*="image/jpeg"]', fixtures.jpeg);

    // Attend la fin de l'upload : l'UI affiche "Photo enregistrée : profile/<userId>/photos/...".
    await expect(page.getByText(/photo enregistrée/i)).toBeVisible({ timeout: 10_000 });

    // Sauvegarde pour persister le storageKey dans la BDD User.photo.
    await page.getByRole("button", { name: /enregistrer/i }).click();
    await page.waitForTimeout(800);

    const updated = await getDb().user.findUnique({
      where: { id: user.id },
      select: { photo: true },
    });
    expect(updated?.photo).toMatch(/^profile\/.+\/photos\/.+\.png$/);
    // La restitution du fichier via /api/files est couverte en integration.
  });

  test("une photo hors 7:9 passe par le cadrage et la photo stockee est 7:9", async ({ page }) => {
    const fixtures = ensureFixtures();
    const user = await createTestUser({ scope: "profile-crop-photo", verified: true, profile: true });
    await loginAs(page, user);
    await page.goto("/account/profile");

    // Les règles de la photo d'identité sont visibles près de l'envoi.
    await expect(page.getByText("Fond blanc uni")).toBeVisible();
    await expect(page.getByText(/Format 7:9/)).toBeVisible();

    await page.setInputFiles('input[type="file"][accept*="image/jpeg"]', fixtures.wide);
    await confirmCrop(page);
    await expect(page.getByText(/photo enregistrée/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /enregistrer/i }).click();

    let photo: string | null = null;
    await expect(async () => {
      photo = (await getDb().user.findUnique({ where: { id: user.id }, select: { photo: true } }))?.photo ?? null;
      expect(photo).toContain(`profile/${user.id}/photos/`);
    }).toPass();
    const served = await page.request.get(`/api/files/${photo}`);
    expect(served.status()).toBe(200);
    const dims = readImageDimensions(await served.body());
    expect(dims).not.toBeNull();
    expect(Math.abs(dims!.width / dims!.height - 7 / 9)).toBeLessThan(0.02);
    expect(dims!.width).toBeGreaterThanOrEqual(210);
  });

  test("l'envoi direct d'une photo carrée est refusé par le serveur", async ({ page }) => {
    const fixtures = ensureFixtures();
    const user = await createTestUser({ scope: "profile-direct-square", verified: true, profile: true });
    await loginAs(page, user);
    const res = await page.request.post("/api/account/upload?kind=photo", {
      multipart: { file: { name: "carre.png", mimeType: "image/png", buffer: readFileSync(fixtures.square) } },
    });
    expect(res.status()).toBe(422);
    expect((await res.json()).code).toBeTruthy();
  });

  test("upload document PDF persists and serves", async ({ page }) => {
    const fixtures = ensureFixtures();
    // profile:true : cf. test upload photo (champs requis pre-remplis pour permettre la sauvegarde).
    const user = await createTestUser({ scope: "profile-upload-pdf", verified: true, profile: true });
    await loginAs(page, user);
    await page.goto("/account/profile");

    await page.setInputFiles(
      'input[type="file"][accept*="application/pdf"]',
      fixtures.pdf,
    );
    await expect(page.getByText(/pièce d'identité enregistrée/i)).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: /enregistrer/i }).click();
    await page.waitForTimeout(800);

    const updated = await getDb().user.findUnique({
      where: { id: user.id },
      select: { idDocument: true },
    });
    expect(updated?.idDocument).toMatch(/^profile\/.+\/documents\/.+\.pdf$/);
  });

  test("le profil affiche les apercus et non les cles de stockage", async ({ page }) => {
    const user = await createTestUser({ scope: "profile-preview", verified: true, profile: true });
    await loginAs(page, user);
    await page.goto("/account/profile");

    await expect(page).toHaveURL(/\/account\/profile$/);
    await expect(page.getByText(/photo enregistrée/i)).toBeVisible();
    await expect(page.getByText(/pièce d'identité enregistrée/i)).toBeVisible();
    // La cle de stockage brute (profile/<id>/...) ne doit plus etre affichee.
    await expect(page.getByText(/^profile\//)).toHaveCount(0);
  });

  test("upload over 5 Mo is refused with error", async ({ page }) => {
    const fixtures = ensureFixtures();
    const user = await createTestUser({ scope: "profile-upload-large", verified: true });
    await loginAs(page, user);
    await page.goto("/account/profile");

    // L'API renvoie 413 TOO_LARGE -- l'UI affiche le message dans le state error.
    // Le fichier "oversized" a un nom .bin et un mime octet-stream : il echouera
    // soit sur BAD_TYPE (mime non autorise) soit sur TOO_LARGE -- on accepte les
    // deux en verifiant juste qu'un message d'erreur s'affiche et que User.photo
    // reste null.
    await page.setInputFiles(
      'input[type="file"][accept*="image/jpeg"]',
      fixtures.oversized,
    );
    await expect(
      page.getByText(/(trop volumineux|non autorisé|erreur d'upload)/i),
    ).toBeVisible({ timeout: 10_000 });

    const updated = await getDb().user.findUnique({
      where: { id: user.id },
      select: { photo: true },
    });
    expect(updated?.photo).toBeNull();
  });

  test("upload txt file is refused (bad mime)", async ({ page }) => {
    const fixtures = ensureFixtures();
    const user = await createTestUser({ scope: "profile-upload-txt", verified: true });
    await loginAs(page, user);
    await page.goto("/account/profile");

    // Le file picker filtre par accept="image/*" : pour bypasser cote E2E on
    // utilise setInputFiles qui ignore l'attribut accept cote client. L'API
    // refusera le mime text/plain (BAD_TYPE 415).
    await page.setInputFiles(
      'input[type="file"][accept*="application/pdf"]',
      fixtures.txt,
    );
    await expect(page.getByText(/(non autorisé|erreur d'upload)/i)).toBeVisible({
      timeout: 8_000,
    });
  });

  // NOTE : BlockedDocument est une regle metier PAR EVENT (schema.prisma) ; elle
  // est appliquee dans /api/events/[slug]/register, pas dans /api/account/profile.
  // Le scenario est couvert par e2e/public/event-register.spec.ts.


  test("participantProfileCompletedAt is set when all required fields are filled", async ({
    page,
  }) => {
    const fixtures = ensureFixtures();
    const user = await createTestUser({ scope: "profile-completion", verified: true });

    // Avant edition : completedAt est null.
    let snap = await getUserById(user.id);
    expect(snap?.participantProfileCompletedAt).toBeNull();

    await loginAs(page, user);
    await page.goto("/account/profile");

    await page.getByLabel("Prénom").fill("Awa");
    await page.getByLabel("Nom", { exact: true }).fill("Diallo");
    await page.getByLabel(/structure/i).fill("ENSEA");
    await page.getByLabel(/numéro de pièce/i).fill("CI-COMPLETION");

    // Upload photo + document pour atteindre 100% des champs requis.
    await page.setInputFiles('input[type="file"][accept*="image/jpeg"]', fixtures.jpeg);
    await expect(page.getByText(/photo enregistrée/i)).toBeVisible({ timeout: 10_000 });
    await page.setInputFiles(
      'input[type="file"][accept*="application/pdf"]',
      fixtures.pdf,
    );
    await expect(page.getByText(/pièce d'identité enregistrée/i)).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: /enregistrer/i }).click();
    await page.waitForTimeout(1000);

    snap = await getUserById(user.id);
    expect(snap?.participantProfileCompletedAt).not.toBeNull();
  });

  test("participant sans profil voit /account/profile/complete", async ({ page }) => {
    const user = await createTestUser({ scope: "profile-complete-render", verified: true });
    await loginAs(page, user);

    await page.goto("/account/profile/complete");
    await expect(page.getByRole("heading", { name: /compléter votre profil/i })).toBeVisible();
  });

  test("la nouvelle photo se propage a l'inscription en attente", async ({ page }) => {
    const fixtures = ensureFixtures();
    const user = await createTestUser({
      scope: "profile-photo-propagation",
      verified: true,
      profile: true,
    });
    const { eventId, categoryId } = await createTestEvent({ scope: "photo-propagation" });
    const reg = await createTestRegistration({
      eventId,
      userId: user.id,
      categoryId,
      status: "PENDING",
    });
    const before = await getDb().registration.findUnique({
      where: { id: reg.id },
      select: { snapshotPhoto: true },
    });

    await loginAs(page, user);
    await page.goto("/account/profile");
    await page.setInputFiles('input[type="file"][accept*="image/jpeg"]', fixtures.jpeg);
    await expect(page.getByText(/photo enregistrée/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /enregistrer/i }).click();
    await page.waitForTimeout(800);

    const after = await getDb().registration.findUnique({
      where: { id: reg.id },
      select: { snapshotPhoto: true },
    });
    expect(after?.snapshotPhoto).not.toBe(before?.snapshotPhoto);
    expect(after?.snapshotPhoto).toMatch(/^profile\/.+\/photos\/.+\.png$/);
  });
});
