import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, createTestUser, disconnectDb, getDb } from "../helpers/db";
import { loginAs } from "../helpers/auth";

// Routes participant gardées par permission (lot 2c).
test.describe("Compte — permissions participant", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("un retrait de registration.self.create refuse l'inscription (403) sans bloquer la lecture du profil", async ({ page }) => {
    const user = await createTestUser({ scope: "acc-revoke", verified: true, profile: true });
    await getDb().userPermissionOverride.create({
      data: { userId: user.id, orgId: null, permission: "registration.self.create", effect: "REVOKE" },
    });
    await loginAs(page, user);

    const register = await page.request.post("/api/events/e2e-inexistant/register", { data: {} });
    expect(register.status()).toBe(403);
    const profile = await page.request.get("/api/account/profile");
    expect(profile.status()).toBe(200);
  });

  test("un compte archivé avec une session ouverte est refusé (401) sur les écritures", async ({ page }) => {
    const user = await createTestUser({ scope: "acc-archived", verified: true, profile: true });
    await loginAs(page, user);
    await getDb().user.update({ where: { id: user.id }, data: { archived: true, archivedAt: new Date() } });

    const res = await page.request.put("/api/account/profile", { data: {} });
    expect(res.status()).toBe(401);
  });
});
