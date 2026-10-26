import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, createTestUser, disconnectDb } from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { toast, countRequests, abortNetwork, failWith500Html } from "../helpers/feedback";

// Loader et toast sur les pages publiques, l'authentification et /account (spec 28).
test.describe("Feedback — public, auth et /account", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("réseau coupé sur forgot-password : toast de repli, bouton réactivé, aucun message anglais", async ({ page }) => {
    await abortNetwork(page, "**/api/auth/forgot-password");

    await page.goto("/forgot-password");
    await page.getByLabel(/adresse e-mail/i).fill("nobody@v2-11-e2e.test");
    const submit = page.getByRole("button", { name: /envoyer le lien/i });
    await submit.click();

    await expect(toast(page, "Erreur, réessayez.")).toBeVisible();
    await expect(page.getByText(/failed to fetch/i)).toHaveCount(0);
    await expect(submit).toBeEnabled();
  });

  test("reset-password : confirmation différente -> message sous le champ, aucune requête, aucun toast", async ({ page }) => {
    const posts = countRequests(page, "POST", "/api/auth/reset-password");

    await page.goto("/reset-password/jeton-e2e");
    await page.getByLabel("Nouveau mot de passe").fill("MotDePasse1!");
    await page.getByLabel("Confirmer le mot de passe").fill("Autre1234!");
    await page.getByRole("button", { name: /mettre à jour/i }).click();

    await expect(page.getByText("Les mots de passe ne correspondent pas.")).toBeVisible();
    expect(posts()).toBe(0);
    await expect(toast(page, /./)).toHaveCount(0);
  });

  test("double clic sur « Enregistrer » du profil : un seul PUT", async ({ page }) => {
    const user = await createTestUser({ scope: "fb-profile-dbl", verified: true, profile: true });
    await loginAs(page, user);
    const puts = countRequests(page, "PUT", "/api/account/profile");

    await page.goto("/account/profile");
    await page.getByRole("button", { name: /^enregistrer$/i }).dblclick();

    await expect(toast(page, "Profil enregistré.")).toBeVisible();
    expect(puts()).toBe(1);
  });

  test("mobile 375 px : un toast d'erreur ne recouvre pas l'en-tête", async ({ page }) => {
    const user = await createTestUser({ scope: "fb-profile-mobile", verified: true, profile: true });
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAs(page, user);
    await failWith500Html(page, "**/api/account/profile");

    await page.goto("/account/profile");
    await page.getByRole("button", { name: /^enregistrer$/i }).click();

    const t = toast(page, "Erreur de mise à jour.");
    await expect(t).toBeVisible();
    const toastBox = await t.boundingBox();
    const headerBox = await page.locator("header").first().boundingBox();
    expect(toastBox).not.toBeNull();
    expect(headerBox).not.toBeNull();
    expect(toastBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
  });
});
