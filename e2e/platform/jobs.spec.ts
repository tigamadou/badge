import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, createTestStaff, createTestUser, disconnectDb } from "../helpers/db";
import { cleanupTestEmailJobs, createTestEmailJob } from "../helpers/jobs";
import { mailpit } from "../helpers/mailpit";
import { loginAndEnter } from "../helpers/nav";

const PREFIX = "e2e-jobs-";
const jobEmail = (tag: string) => `${PREFIX}${tag}-${Date.now()}@e2e.test`;

// Spec 23 : suivi et administration des emails de la file (worker de dev actif).
test.describe("Platform — Emails (queue)", () => {
  test.afterAll(async () => {
    await cleanupTestEmailJobs(PREFIX);
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("le staff ouvre Emails depuis le menu", async ({ page }) => {
    const staff = await createTestStaff({ role: "STAFF_OBSERVER", scope: "jobs-menu" });
    await loginAndEnter(page, staff, { kind: "platform" });

    await page.locator("#app-shell-nav").getByRole("link", { name: "Emails" }).click();
    await expect(page).toHaveURL(/\/platform\/jobs$/);
    await expect(page.getByRole("heading", { name: "Emails" })).toBeVisible();
    await expect(page.getByText("File d'envoi des emails de la plateforme")).toBeVisible();
  });

  test("un email déclenché apparaît comme envoyé", async ({ page }) => {
    await page.context().setExtraHTTPHeaders({
      "x-forwarded-for": `203.0.113.${1 + Math.floor(Math.random() * 250)}`,
    });
    const user = await createTestUser({ scope: "jobs-forgot", verified: true });
    await page.goto("/forgot-password");
    await page.getByLabel(/adresse e-mail/i).fill(user.email);
    await page.getByRole("button", { name: /envoyer le lien/i }).click();
    await mailpit.expectMail({ to: user.email, timeoutMs: 15000 });

    const staff = await createTestStaff({ role: "STAFF_ADMIN", scope: "jobs-sent" });
    await loginAndEnter(page, staff, { kind: "platform" });
    await page.goto(`/platform/jobs?q=${encodeURIComponent(user.email)}`);

    const row = page.getByRole("row").filter({ hasText: user.email });
    await expect(row.getByText("Envoyé")).toBeVisible();
    await row.getByRole("link", { name: "Voir le détail" }).click();
    await expect(page.getByText("Contenu masqué")).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);
  });

  test("un email en échec se relance et arrive", async ({ page }) => {
    const to = jobEmail("retry");
    const job = await createTestEmailJob({
      to,
      kind: "registration.approved",
      status: "FAILED",
      subject: "Relance e2e",
      html: "<p>Relance e2e</p>",
      attempts: 5,
      lastError: "SMTP down",
    });
    const staff = await createTestStaff({ role: "STAFF_ADMIN", scope: "jobs-retry" });
    await loginAndEnter(page, staff, { kind: "platform" });
    await page.goto(`/platform/jobs/${job.id}`);

    await expect(page.getByText("SMTP down")).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(1);
    await page.getByRole("button", { name: "Relancer" }).click();
    await expect(page.getByText("Email relancé.")).toBeVisible();

    await mailpit.expectMail({ to, bodyPattern: /Relance e2e/, timeoutMs: 15000 });
    await page.reload();
    await expect(page.getByText("Envoyé").first()).toBeVisible();
  });

  test("un email en attente s'annule", async ({ page }) => {
    const job = await createTestEmailJob({
      to: jobEmail("cancel"),
      kind: "registration.approved",
      status: "PENDING",
      subject: "Annulation e2e",
      html: "<p>Annulation e2e</p>",
      runAt: new Date(Date.now() + 3_600_000),
    });
    const staff = await createTestStaff({ role: "STAFF_ADMIN", scope: "jobs-cancel" });
    await loginAndEnter(page, staff, { kind: "platform" });
    await page.goto(`/platform/jobs/${job.id}`);

    await page.getByRole("button", { name: "Annuler l'envoi" }).click();
    await expect(page.getByText("Envoi annulé.")).toBeVisible();
    await expect(page.getByText("Annulé").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Relancer" })).toBeVisible();
  });

  test("le support voit la liste mais aucune action", async ({ page }) => {
    const job = await createTestEmailJob({
      to: jobEmail("support"),
      kind: "registration.approved",
      status: "FAILED",
      subject: "Support e2e",
      html: "<p>Support e2e</p>",
      attempts: 5,
      lastError: "SMTP down",
    });
    const staff = await createTestStaff({ role: "STAFF_SUPPORT", scope: "jobs-support" });
    await loginAndEnter(page, staff, { kind: "platform" });
    await page.goto(`/platform/jobs/${job.id}`);

    await expect(page.getByText("SMTP down")).toBeVisible();
    await expect(page.getByRole("button", { name: "Relancer" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Annuler l'envoi" })).toHaveCount(0);
  });

  test("un Imprimeur n'a pas Emails dans le menu et est renvoye en URL directe", async ({ page }) => {
    const staff = await createTestStaff({ role: "STAFF_PRINTER", scope: "jobs-printer" });
    await loginAndEnter(page, staff, { kind: "platform" });

    await expect(page.locator("#app-shell-nav").getByRole("link", { name: "Emails" })).toHaveCount(0);
    await page.goto("/platform/jobs");
    await expect(page).toHaveURL(/\/platform$/);
  });
});
