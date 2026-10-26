import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestCategory,
  createTestEvent,
  createTestEventMember,
  createTestRegistration,
  createTestUser,
  disconnectDb,
  makeEventAdminUser,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";
import { toast, countRequests, failWith500Html, abortNetwork } from "../helpers/feedback";

// Loader et toast sur les actions de /event (spec 28).
test.describe("Feedback — /event", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  async function seedPendingReg(scope: string) {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope });
    const participant = await createTestUser({ scope: `${scope}-part`, verified: true, profile: true });
    const reg = await createTestRegistration({ eventId, userId: participant.id, categoryId, status: "PENDING" });
    const admin = await makeEventAdminUser({ scope, eventId, orgId });
    return { orgId, eventId, reg, admin };
  }

  test("double clic sur « Approuver » : un seul POST approve", async ({ page }) => {
    const { eventId, reg, admin } = await seedPendingReg("fb-ev-approve");
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    const posts = countRequests(page, "POST", "/approve");

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
    await page.getByRole("button", { name: /approuver/i }).dblclick();

    await expect(toast(page, "Inscription approuvée.")).toBeVisible();
    expect(posts()).toBe(1);
  });

  test("erreur 500 sur le blocage d'e-mail : toast de repli, aucun alert() natif", async ({ page }) => {
    const { eventId, reg, admin } = await seedPendingReg("fb-ev-block-500");
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    const dialogs: string[] = [];
    page.on("dialog", (d) => {
      dialogs.push(d.type());
      void d.accept();
    });
    await failWith500Html(page, "**/block-email");

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
    await page.getByRole("button", { name: /bloquer cet e-mail/i }).click();

    await expect(toast(page, "Échec du blocage de l'e-mail.")).toBeVisible();
    expect(dialogs).toEqual(["confirm"]);
  });

  test("scan manuel avec réseau coupé : toast de repli, bouton « Vérifier » réactivé", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "fb-ev-scan" });
    const operator = await createTestEventMember({ scope: "fb-ev-scan", orgId, eventId, role: "OPERATOR" });
    await loginAndEnter(page, operator, { kind: "event", id: eventId });
    await abortNetwork(page, "**/scan/verify");

    await page.goto(`/event/${eventId}/scan`);
    await page.getByRole("button", { name: /saisie manuelle/i }).click();
    await page.getByPlaceholder(/id de badge ou contenu qr/i).fill("123456");
    const verify = page.getByRole("button", { name: /^vérifier$/i });
    await verify.click();

    await expect(toast(page, "Vérification impossible. Réessayez.")).toBeVisible();
    await expect(verify).toBeEnabled();
  });

  test("création de catégorie : la modale se ferme, toast de succès, aucune erreur console", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "fb-ev-cat" });
    const admin = await makeEventAdminUser({ scope: "fb-ev-cat", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    await page.goto(`/event/${eventId}/categories`);
    await page.getByRole("button", { name: /ajouter/i }).click();
    await page.getByRole("textbox", { name: "Nom", exact: true }).fill(`Feedback ${Date.now()}`);
    await page.getByLabel("Numéro").fill("55");
    await page.getByRole("button", { name: "Créer", exact: true }).click();

    await expect(page.getByRole("heading", { name: /nouvelle catégorie/i })).toBeHidden();
    await expect(toast(page, "Catégorie créée.")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("numéro de catégorie déjà pris : message sous le champ, aucun toast", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "fb-ev-cat-dup" });
    await createTestCategory({ eventId, number: 90 });
    const admin = await makeEventAdminUser({ scope: "fb-ev-cat-dup", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/categories`);
    await page.getByRole("button", { name: /ajouter/i }).click();
    await page.getByRole("textbox", { name: "Nom", exact: true }).fill(`Doublon ${Date.now()}`);
    await page.getByLabel("Numéro").fill("90");
    await page.getByRole("button", { name: "Créer", exact: true }).click();

    await expect(page.getByText(/le numéro 90 est déjà utilisé/i)).toBeVisible();
    await expect(toast(page, /./)).toHaveCount(0);
  });

  test("double clic sur « Enregistrer » des réglages : un seul PATCH", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "fb-ev-settings" });
    const admin = await makeEventAdminUser({ scope: "fb-ev-settings", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    const patches = countRequests(page, "PATCH", `/api/org/${orgId}/events/${eventId}`);

    await page.goto(`/event/${eventId}/settings`);
    await page.getByRole("button", { name: /^enregistrer$/i }).first().dblclick();

    await expect(toast(page, "Événement mis à jour.")).toBeVisible();
    expect(patches()).toBe(1);
  });
});
