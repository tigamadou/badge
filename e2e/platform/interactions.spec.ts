import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  createTestStaff,
  createTestUser,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";
import { mailpit } from "../helpers/mailpit";
import { expectLastActivity } from "../helpers/audit";

// Complete la couverture E2E des pages platform avec les interactions UI qui ne
// sont testees NULLE PART ailleurs : rbac.spec.ts / orgs.spec.ts / users.spec.ts /
// settings.spec.ts / activity.spec.ts exercent deja la plupart des effets via
// page.request (API directe). pages-render.spec.ts ne fait que verifier le rendu
// (aucun clic, aucune soumission de formulaire). Ce fichier cible specifiquement
// le parcours utilisateur reel : remplir un formulaire, cliquer un bouton, et
// asserter l'effet (BDD / feedback UI / audit).
//
// Plans crees directement en BDD ici (hors createTestOrgWithOwner) ne sont PAS
// couverts par cleanupE2ETestData (qui ne connait que users/events/orgs par
// prefixe/suffixe) : on les traque dans `createdPlanIds` et on les supprime
// explicitement en afterAll, apres le cleanup standard (qui cascade-supprime
// les Subscription des orgs e2e-*, liberant la contrainte FK sur Plan).
const createdPlanIds: string[] = [];

test.describe("Staff > interactions UI (formulaires, boutons, filtres)", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    if (createdPlanIds.length > 0) {
      await getDb().plan.deleteMany({ where: { id: { in: createdPlanIds } } });
    }
    await disconnectDb();
  });

  test("Users/new > cree un client via le formulaire UI, lie a une org avec role AUDITOR", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "interactions-user-client" });
    const org = await getDb().organization.findUnique({ where: { id: orgId }, select: { name: true } });
    await loginAsStaff(page, { role: "STAFF_SUPPORT", scope: "interactions-user-client-actor" });
    await mailpit.clear();

    const email = `e2e-interactions-client-${Date.now()}-${Math.floor(Math.random() * 1e6)}@v2-11-e2e.test`;

    await page.goto("/platform/users/new");
    await page.getByLabel(/Adresse e-mail/i).fill(email);
    await page.getByLabel(/Nom complet/i).fill("Client Interactions E2E");
    // "Client" est deja selectionne par defaut : on ne touche pas au RadioCards.
    await page.getByRole("combobox", { name: /organisation/i }).selectOption({ label: org!.name });
    await page.getByRole("combobox", { name: /rôle dans l.organisation/i }).selectOption("AUDITOR");
    await page.getByRole("button", { name: /créer et inviter/i }).click();

    await page.waitForURL(/\/platform\/users\/(?!new)[a-z0-9]+/i, { timeout: 10_000 });

    const dbUser = await getDb().user.findUnique({
      where: { email },
      select: { id: true, isStaff: true, staffRole: true },
    });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.isStaff).toBe(false);
    expect(dbUser?.staffRole).toBeNull();

    const membership = await getDb().orgMembership.findFirst({
      where: { userId: dbUser!.id, orgId },
      select: { role: true },
    });
    expect(membership?.role).toBe("AUDITOR");

    await mailpit.expectMail({ to: email, subjectPattern: /bienvenue|invitation/i, timeoutMs: 8000 });
    await expectLastActivity({ type: "USER_CREATED", targetId: dbUser!.id });
  });

  test("Users/new > cree un staff STAFF_SUPPORT via le formulaire UI (radio + select role)", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "interactions-user-staff-actor" });
    await mailpit.clear();

    const email = `e2e-interactions-staff-${Date.now()}-${Math.floor(Math.random() * 1e6)}@v2-11-e2e.test`;

    await page.goto("/platform/users/new");
    await page.getByLabel(/Adresse e-mail/i).fill(email);
    await page.getByLabel(/Nom complet/i).fill("Staff Interactions E2E");
    await page.getByRole("radio", { name: /Staff applicatif/i }).click();
    await page.getByRole("combobox", { name: /^Rôle$/i }).selectOption("STAFF_SUPPORT");
    await page.getByRole("button", { name: /créer et inviter/i }).click();

    await page.waitForURL(/\/platform\/users\/(?!new)[a-z0-9]+/i, { timeout: 10_000 });

    const dbUser = await getDb().user.findUnique({
      where: { email },
      select: { id: true, isStaff: true, staffRole: true },
    });
    expect(dbUser?.isStaff).toBe(true);
    expect(dbUser?.staffRole).toBe("STAFF_SUPPORT");

    await mailpit.expectMail({ to: email, subjectPattern: /bienvenue|invitation/i, timeoutMs: 8000 });
  });

  test("Users/[userId] > reset password via le bouton UI (mail + audit)", async ({ page }) => {
    const target = await createTestUser({ scope: "interactions-user-reset-target", verified: true });
    await loginAsStaff(page, { role: "STAFF_SUPPORT", scope: "interactions-user-reset-actor" });
    await mailpit.clear();

    const before = await getDb().user.findUnique({ where: { id: target.id }, select: { inviteToken: true } });

    await page.goto(`/platform/users/${target.id}`);
    await page.getByRole("button", { name: /renvoyer un lien de configuration de mot de passe/i }).click();
    await expect(page.getByText(/lien d'invitation regenere/i)).toBeVisible();

    const after = await getDb().user.findUnique({
      where: { id: target.id },
      select: { inviteToken: true, inviteTokenExpiry: true },
    });
    expect(after?.inviteToken).not.toBeNull();
    expect(after?.inviteToken).not.toBe(before?.inviteToken);

    await mailpit.expectMail({
      to: target.email,
      subjectPattern: /reinitialisation|réinitialisation|mot de passe/i,
      timeoutMs: 8000,
    });
    await expectLastActivity({ type: "USER_PASSWORD_SET", targetId: target.id });
  });

  test("Users/[userId] > archive via le bouton UI (soft delete + audit)", async ({ page }) => {
    const target = await createTestUser({ scope: "interactions-user-archive-target", verified: true });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "interactions-user-archive-actor" });

    await page.goto(`/platform/users/${target.id}`);
    await page.getByRole("button", { name: /archiver l'utilisateur/i }).click();
    await expect(page.getByText(/utilisateur archive/i)).toBeVisible();

    const after = await getDb().user.findUnique({
      where: { id: target.id },
      select: { archived: true, archivedAt: true },
    });
    expect(after?.archived).toBe(true);
    expect(after?.archivedAt).not.toBeNull();

    await expectLastActivity({ type: "USER_DELETED", targetId: target.id });
  });

  test("Users > filtre principal (recherche q) via le formulaire UI, y compris etat vide", async ({ page }) => {
    const match = await createTestUser({ scope: "interactions-user-filter-match", verified: true });
    const other = await createTestStaff({ role: "STAFF_OBSERVER", scope: "interactions-user-filter-other" });
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "interactions-user-filter-actor" });

    await page.goto("/platform/users");
    await page.getByPlaceholder(/rechercher un utilisateur/i).fill(match.email);
    await page.getByRole("button", { name: /^filtrer$/i }).click();

    await page.waitForURL(/[?&]q=/);
    await expect(page.getByText(match.email)).toBeVisible();
    await expect(page.getByText(other.email)).not.toBeVisible();

    // Etat vide : requete sans aucune correspondance possible.
    const nothingQuery = `nonexistent-e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await page.getByPlaceholder(/rechercher un utilisateur/i).fill(nothingQuery);
    await page.getByRole("button", { name: /^filtrer$/i }).click();
    await page.waitForURL(/[?&]q=/);
    await expect(page.getByText(/aucun utilisateur/i)).toBeVisible();
  });

  test("Plans > cree un plan via le formulaire UI (apparait dans le catalogue) puis archive/restaure", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "interactions-plan-create" });

    const planName = `E2E Plan Interactions ${Date.now()}`;

    await page.goto("/platform/plans");
    await page.getByLabel("Nom").fill(planName);
    await page.getByLabel(/Max events/i).fill("5");
    await page.getByLabel(/Max participants\/event/i).fill("100");
    await page.getByRole("button", { name: /créer le plan/i }).click();

    const row = page.locator("tr", { hasText: planName });
    await expect(row).toBeVisible();
    await expect(row).toContainText("5");
    await expect(row).toContainText("100");

    const dbPlan = await getDb().plan.findUnique({ where: { name: planName } });
    expect(dbPlan).not.toBeNull();
    expect(dbPlan?.maxEvents).toBe(5);
    expect(dbPlan?.maxParticipantsPerEvent).toBe(100);
    expect(dbPlan?.archived).toBe(false);
    createdPlanIds.push(dbPlan!.id);

    // Toggle archive/restore via le bouton de la ligne (edition du cycle de vie du plan).
    await row.getByRole("button", { name: /archiver/i }).click();
    await expect(row.getByRole("button", { name: /restaurer/i })).toBeVisible();
    let refreshed = await getDb().plan.findUnique({ where: { id: dbPlan!.id }, select: { archived: true } });
    expect(refreshed?.archived).toBe(true);

    await row.getByRole("button", { name: /restaurer/i }).click();
    await expect(row.getByRole("button", { name: /archiver/i })).toBeVisible();
    refreshed = await getDb().plan.findUnique({ where: { id: dbPlan!.id }, select: { archived: true } });
    expect(refreshed?.archived).toBe(false);

    // NB : l'etat vide du catalogue n'est pas teste ici. /platform/plans liste
    // TOUS les plans sans filtre (cf. src/app/platform/plans/page.tsx), et la
    // BDD dev partagee contient toujours des plans (seed + autres specs e2e
    // qui dependent de Plan/Subscription). Vider le catalogue casserait ces
    // dependances (contrainte FK Subscription -> Plan) ; non teste par choix.
  });

  test("Settings > modifie smtpUser (non-secret) via le formulaire UI -> persiste + feedback", async ({ page }) => {
    const before = await getDb().platformSettings.findUnique({
      where: { id: "singleton" },
      select: { smtpUser: true },
    });
    const admin = await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "interactions-settings-smtpuser" });

    const newSmtpUser = `e2e-smtpuser-${Date.now()}`;

    await page.goto("/platform/settings");
    await page.getByLabel(/Utilisateur SMTP/i).fill(newSmtpUser);
    await page.getByRole("button", { name: /enregistrer les paramètres/i }).click();
    await expect(page.getByText(/paramètres enregistrés/i)).toBeVisible();

    const after = await getDb().platformSettings.findUnique({
      where: { id: "singleton" },
      select: { smtpUser: true },
    });
    expect(after?.smtpUser).toBe(newSmtpUser);

    const audit = await expectLastActivity({ type: "PLATFORM_SETTINGS_UPDATED", userId: admin.id });
    const details = audit.details as { changedFields?: string[] } | null;
    expect(details?.changedFields).toEqual(expect.arrayContaining(["smtpUser"]));

    // Restaure la valeur d'origine pour ne pas polluer les runs suivants du singleton partage.
    await getDb().platformSettings.update({
      where: { id: "singleton" },
      data: { smtpUser: before?.smtpUser ?? "" },
    });
  });

  test("Settings/badge > selectionne un template via l'UI -> persiste, puis restaure default-v1", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "interactions-settings-badge" });

    await page.goto("/platform/settings/badge");
    await page.getByTestId("select-recto-verso-v1").click();
    await expect(page.getByTestId("save-success")).toBeVisible();
    await expect(page.getByTestId("template-card-recto-verso-v1")).toHaveAttribute("data-selected", "true");

    let dbSettings = await getDb().platformSettings.findUnique({
      where: { id: "singleton" },
      select: { badgeTemplateId: true },
    });
    expect(dbSettings?.badgeTemplateId).toBe("recto-verso-v1");
    await expectLastActivity({ type: "PLATFORM_SETTINGS_UPDATED" });

    // Restaure la baseline default-v1 attendue par les autres specs (settings.spec.ts,
    // parcours de generation de badge) en reutilisant le meme parcours UI.
    await page.getByTestId("select-default-v1").click();
    await expect(page.getByTestId("template-card-default-v1")).toHaveAttribute("data-selected", "true");
    dbSettings = await getDb().platformSettings.findUnique({
      where: { id: "singleton" },
      select: { badgeTemplateId: true },
    });
    expect(dbSettings?.badgeTemplateId).toBe("default-v1");
  });

  test("Organizations/[orgId]/subscription > reassigne un plan via SubscriptionForm UI -> persiste + audit", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "interactions-subscription" });
    const targetPlan = await getDb().plan.create({
      data: { name: `e2e-plan-interactions-target-${Date.now()}`, maxEvents: null, maxParticipantsPerEvent: null },
    });
    createdPlanIds.push(targetPlan.id);

    const admin = await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "interactions-subscription-actor" });

    await page.goto(`/platform/organizations/${orgId}/subscription`);
    await page.getByLabel("Plan").selectOption({ label: targetPlan.name });
    await page.getByLabel(/Override max events/i).fill("10");
    await page.getByRole("button", { name: /enregistrer l'abonnement/i }).click();

    await expect(page.getByText(/^enregistré\.?$/i)).toBeVisible();

    const sub = await getDb().subscription.findUnique({
      where: { orgId },
      select: { planId: true, overrideMaxEvents: true },
    });
    expect(sub?.planId).toBe(targetPlan.id);
    expect(sub?.overrideMaxEvents).toBe(10);

    await expectLastActivity({ type: "SUBSCRIPTION_UPDATED", orgId, userId: admin.id });
  });
});
