import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  disconnectDb,
} from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";

test.describe("Staff > matrice RBAC", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("STAFF_OBSERVER : POST /api/platform/organizations -> 403", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "rbac-obs-orgs" });
    const res = await page.request.post("/api/platform/organizations", {
      data: {
        name: "Obs Org",
        ownerEmail: `e2e-rbac-${Date.now()}@v2-11-e2e.test`,
      },
    });
    expect(res.status()).toBe(403);
  });

  test("STAFF_OBSERVER : POST /api/platform/users (client) -> 403", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "rbac-obs-users" });
    const res = await page.request.post("/api/platform/users", {
      data: {
        email: `e2e-rbac-cli-${Date.now()}@v2-11-e2e.test`,
        name: "Cli",
        type: "client",
      },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("INSUFFICIENT_STAFF_ROLE");
  });

  test("STAFF_OBSERVER : UI /platform/organizations/new (bouton creation present mais POST 403)", async ({
    page,
  }) => {
    // La page /platform/organizations/new est accessible (le layout exige seulement
    // staffRole; la creation reelle est gardee cote API). On verifie donc que
    // l'API renvoie 403 quand l'observer tente le POST direct via le form
    // (par requete page.request).
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "rbac-obs-newui" });
    await page.goto("/platform/organizations/new");
    // Form present : on confirme que la page se charge sans crash.
    await expect(page.getByRole("heading", { name: /nouvelle organisation/i })).toBeVisible();

    // Mais le POST API est verrouille.
    const res = await page.request.post("/api/platform/organizations", {
      data: {
        name: "Obs Org UI",
        ownerEmail: `e2e-rbac-newui-${Date.now()}@v2-11-e2e.test`,
      },
    });
    expect(res.status()).toBe(403);
  });

  test("STAFF_SUPPORT : POST /api/platform/users type=staff -> 403 STAFF_ADMIN_REQUIRED", async ({
    page,
  }) => {
    await loginAsStaff(page, { role: "STAFF_SUPPORT", scope: "rbac-sup-staff" });
    const res = await page.request.post("/api/platform/users", {
      data: {
        email: `e2e-rbac-supp-${Date.now()}@v2-11-e2e.test`,
        name: "Staff",
        type: "staff",
        staffRole: "STAFF_OBSERVER",
      },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("STAFF_ADMIN_REQUIRED");
  });

  test("STAFF_SUPPORT : POST /api/platform/organizations -> 403", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_SUPPORT", scope: "rbac-sup-orgs" });
    const res = await page.request.post("/api/platform/organizations", {
      data: {
        name: "Support Org",
        ownerEmail: `e2e-rbac-supp-org-${Date.now()}@v2-11-e2e.test`,
      },
    });
    expect(res.status()).toBe(403);
  });

  test("STAFF_ADMIN : POST /api/platform/users staffRole=SUPER_ADMIN -> 403 SUPER_ADMIN_REQUIRED", async ({
    page,
  }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "rbac-admin-superuser" });
    const res = await page.request.post("/api/platform/users", {
      data: {
        email: `e2e-rbac-su-${Date.now()}@v2-11-e2e.test`,
        name: "SU",
        type: "staff",
        staffRole: "SUPER_ADMIN",
      },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("SUPER_ADMIN_REQUIRED");
  });

  test("STAFF_ADMIN : DELETE hard /api/platform/organizations/[id] -> 403", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "rbac-admin-hard" });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "rbac-admin-hard-actor" });

    const res = await page.request.delete(`/api/platform/organizations/${orgId}`);
    expect(res.status()).toBe(403);
    // withStaffAuth refuse avant la verif de confirmation : on attend
    // INSUFFICIENT_STAFF_ROLE (le wrapper exige SUPER_ADMIN).
    const body = await res.json();
    expect(body.error).toBe("INSUFFICIENT_STAFF_ROLE");
  });

  test("STAFF_ADMIN : PATCH /api/platform/settings smtpPassword -> 403 (SUPER_ADMIN requis)", async ({
    page,
  }) => {
    // ADR 2026-06-01 : seul SUPER_ADMIN peut ecrire smtpPassword / recaptchaSecretKey.
    // Le garde-fou est desormais implemente cote serveur -> STAFF_ADMIN recoit 403.
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "rbac-admin-smtppwd" });
    const res = await page.request.patch("/api/platform/settings", {
      data: { smtpPassword: `pw-${Date.now()}` },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).error).toBe("FORBIDDEN_SECRET_CHANGE");
  });

  test("Tout staff : GET /api/platform/activity -> 200", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "rbac-obs-activity" });
    const res = await page.request.get("/api/platform/activity?pageSize=10");
    expect(res.status()).toBe(200);
  });
});
