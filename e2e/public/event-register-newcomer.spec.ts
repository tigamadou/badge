import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestUser,
  createTestRegistration,
  createTestProfileSubmission,
  createTestStaff,
  getDb,
  disconnectDb,
} from "../helpers/db";
import { loginAs, loginAsEventMember } from "../helpers/auth";
import { mailpit } from "../helpers/mailpit";
import { ensureFixtures } from "../fixtures";

// v4 (plan 09) : parcours complet d'un visiteur qui n'a pas encore de compte.
// Les autres specs creent l'utilisateur directement en base (createTestUser force
// profileStatus=APPROVED des que profile:true) et ne traversent donc jamais la
// creation de compte, la verification e-mail, ni l'etat PENDING.
test.describe("Parcours complet d'un nouvel arrivant", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("cree un compte depuis l'evenement et s'inscrit sans attendre la validation", async ({ page }) => {
    const fixtures = ensureFixtures();
    const { eventSlug } = await createTestEvent({ scope: "newcomer" });
    const email = `e2e-newcomer-${Date.now()}@e2e.local`;
    const password = "Test1234!";

    // 1. Page publique : le CTA mene a la creation de compte en gardant la destination.
    await page.goto(`/e/${eventSlug}`);
    await page.getByRole("link", { name: /créer un compte/i }).click();
    await expect(page).toHaveURL(new RegExp(`/register\\?next=/e/${eventSlug}/register`));

    // 2. Creation du compte.
    await page.getByLabel("Nom complet").fill("Awa Diallo");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel(/^Mot de passe/).fill(password);
    await page.getByLabel(/confirmer le mot de passe/i).fill(password);
    await page.getByRole("button", { name: /créer mon compte/i }).click();
    await expect(page.getByText(/reprendre votre inscription/i)).toBeVisible({ timeout: 10_000 });

    // 3. Lien de verification recupere dans Mailpit, avec la destination portee.
    const mail = await mailpit.expectMail({
      to: email,
      subjectPattern: /Confirmez votre adresse email/i,
      timeoutMs: 15_000,
    });
    const body = await mailpit.getBody(mail.ID);
    const match = body.HTML.match(/\/verify-email\/([A-Za-z0-9_-]+)\?next=([^"'\s]+)/);
    expect(match, "le lien de verification doit porter le parametre next").not.toBeNull();

    await page.goto(`/verify-email/${match![1]}?next=${match![2]}`);
    await page.getByRole("link", { name: /continuer mon inscription/i }).click();
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);

    // 4. Connexion : le callbackUrl ramene sur l'inscription, qui redirige vers le profil.
    await page.getByLabel(/adresse e-?mail/i).fill(email);
    await page.getByLabel("Mot de passe").fill(password);
    await page.getByRole("button", { name: /se connecter/i }).click();
    await page.waitForURL(/\/account\/profile\/complete/, { timeout: 20_000 });

    // 5. Depot des pieces.
    await page.getByLabel("Prénom").fill("Awa");
    await page.getByLabel("Nom", { exact: true }).fill("Diallo");
    await page.getByLabel(/structure/i).fill("ACME E2E");
    await page.getByLabel(/numéro de pièce/i).fill("CI-E2E-NEWCOMER");
    await page.setInputFiles('input[type="file"][accept*="image/jpeg"]', fixtures.jpeg);
    await expect(page.getByText(/photo enregistrée/i)).toBeVisible({ timeout: 10_000 });
    await page.setInputFiles('input[type="file"][accept*="application/pdf"]', fixtures.pdf);
    await expect(page.getByText(/pièce d'identité enregistrée/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /enregistrer/i }).click();

    // 6. Retour automatique sur l'inscription, sans attendre la validation staff.
    await page.waitForURL(new RegExp(`/e/${eventSlug}/register`), { timeout: 20_000 });
    await page.getByRole("radio", { name: /visiteur/i }).check();
    await page.getByRole("checkbox").last().check();
    await page.getByRole("button", { name: /s'inscrire/i }).click();
    await page.waitForURL(new RegExp(`/e/${eventSlug}/success`), { timeout: 20_000 });
    await expect(page.getByText(/en cours de vérification par la plateforme/i)).toBeVisible();

    // 7. Etat en base : inscription creee, profil en attente d'examen.
    const prisma = getDb();
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.profileStatus).toBe("PENDING");
    const reg = await prisma.registration.findFirst({ where: { userId: user!.id } });
    expect(reg?.status).toBe("PENDING");
  });

  test("l'organisation ne peut approuver qu'apres validation du profil par la plateforme", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "gel-org" });
    const participant = await createTestUser({
      scope: "gel-part",
      verified: true,
      profile: true,
      profileStatus: "PENDING",
    });
    const { id: regId } = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
    });
    await createTestProfileSubmission({ userId: participant.id, status: "PENDING" });
    const prisma = getDb();

    // 1. Membre de l'organisation : l'approbation est refusee (profil non valide).
    const member = await loginAsEventMember(page, {
      orgId,
      eventId,
      role: "ADMIN",
      scope: "gel-member",
    });
    await page.goto(`/event/${eventId}/registrations/${regId}`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/registrations/${regId}`));
    // RegistrationActions desactive le bouton tant que le profil n'est pas valide,
    // et affiche le motif a cote : le refus est visible avant meme l'appel API.
    await expect(page.getByRole("button", { name: /^approuver$/i })).toBeDisabled();
    await expect(page.getByText(/profil non validé par la plateforme/i)).toBeVisible();
    expect((await prisma.registration.findUnique({ where: { id: regId } }))?.status).toBe("PENDING");

    // 2. Le staff plateforme valide le profil.
    const staff = await createTestStaff({ role: "STAFF_SUPPORT", scope: "gel-staff" });
    await logout(page);
    await loginAs(page, staff);
    await page.goto(`/platform/profiles/${participant.id}`);
    await expect(page).toHaveURL(new RegExp(`/platform/profiles/${participant.id}`));
    await page.getByRole("button", { name: /^approuver$/i }).click();
    await expect
      .poll(
        async () => (await prisma.user.findUnique({ where: { id: participant.id } }))?.profileStatus,
        { timeout: 10_000 },
      )
      .toBe("APPROVED");

    // 3. Le membre de l'organisation peut desormais approuver l'inscription.
    await logout(page);
    await loginAs(page, member);
    await page.goto(`/event/${eventId}/registrations/${regId}`);
    await page.getByRole("button", { name: /^approuver$/i }).click();
    await expect
      .poll(async () => (await prisma.registration.findUnique({ where: { id: regId } }))?.status, {
        timeout: 10_000,
      })
      .toBe("APPROVED");
  });
});

// Changement d'utilisateur : l'espace evenement n'expose pas le bouton Deconnexion
// de StaffShell. On efface le cookie de session, comme e2e/transverse/security.spec.ts:25.
async function logout(page: import("@playwright/test").Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.waitForURL(/\/login/, { timeout: 8000 });
}
