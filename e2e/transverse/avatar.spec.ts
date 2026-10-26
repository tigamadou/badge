import { test, expect, type Page } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestEventMember,
  createTestOrgMember,
  createTestProfileSubmission,
  createTestStaff,
  createTestUser,
  disconnectDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";

// Photo validée affichée comme avatar (spec 27) : dernière soumission APPROVED,
// repli sur les initiales sans photo ou si l'image ne charge pas.

// PNG 1 x 1 : les photos de test ne sont pas écrites sur le disque.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const JAN = new Date("2026-01-01T10:00:00Z");
const FEB = new Date("2026-02-01T10:00:00Z");

async function servePhotos(page: Page): Promise<void> {
  await page.route("**/api/files/profile/e2e/photos/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PNG_1X1 }),
  );
}

function avatar(page: Page) {
  return page.getByTestId("user-avatar").first();
}

async function expectPhoto(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(avatar(page).locator("img")).toBeVisible();
}

test.describe("Avatar : photo validée", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("sans soumission : initiales, aucune image", async ({ page }) => {
    const user = await createTestUser({
      scope: "avatar-none",
      verified: true,
      profile: true,
      profileStatus: "INCOMPLETE",
    });
    await loginAs(page, user);
    await page.goto("/account");
    await expect(avatar(page)).toContainText("EU");
    await expect(avatar(page).locator("img")).toHaveCount(0);
  });

  test("approuvée puis nouvelle en attente : l'ancienne photo reste", async ({ page }) => {
    const user = await createTestUser({ scope: "avatar-old", verified: true, profile: true });
    await createTestProfileSubmission({
      userId: user.id,
      status: "APPROVED",
      photo: "profile/e2e/photos/old.png",
      createdAt: JAN,
    });
    await createTestProfileSubmission({
      userId: user.id,
      status: "PENDING",
      photo: "profile/e2e/photos/new.png",
      createdAt: FEB,
    });
    await servePhotos(page);
    await loginAs(page, user);
    await page.goto("/account");
    const img = avatar(page).locator("img");
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute("src", "/api/files/profile/e2e/photos/old.png");
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  });

  test("fichier manquant : repli sur les initiales", async ({ page }) => {
    const user = await createTestUser({ scope: "avatar-missing", verified: true, profile: true });
    await createTestProfileSubmission({
      userId: user.id,
      status: "APPROVED",
      photo: "profile/e2e/photos/missing.png",
    });
    await loginAs(page, user);
    await page.goto("/account");
    await page.waitForLoadState("networkidle");
    await expect(avatar(page).locator("img")).toHaveCount(0);
    await expect(avatar(page)).toContainText("EU");
  });

  test("photo visible dans les quatre espaces et les gabarits de rôle", async ({
    page,
    browser,
  }) => {
    const approve = async (userId: string) =>
      createTestProfileSubmission({
        userId,
        status: "APPROVED",
        photo: "profile/e2e/photos/ok.png",
      });
    const { orgId, eventId } = await createTestEvent({ scope: "avatar-spaces" });

    const staff = await createTestStaff({ scope: "avatar", role: "STAFF_ADMIN" });
    await approve(staff.id);
    await servePhotos(page);
    await loginAs(page, staff);
    await expectPhoto(page, "/platform");

    const owner = await createTestOrgMember({ scope: "avatar", orgId, role: "OWNER" });
    await approve(owner.id);
    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await servePhotos(ownerPage);
    await loginAs(ownerPage, owner);
    await expectPhoto(ownerPage, `/org/${orgId}`);
    await expectPhoto(ownerPage, `/event/${eventId}`);
    await ownerCtx.close();

    for (const role of ["OPERATOR", "PRINTER", "VIEWER"] as const) {
      const member = await createTestEventMember({
        scope: `avatar-${role.toLowerCase()}`,
        eventId,
        orgId,
        role,
      });
      await approve(member.id);
      const ctx = await browser.newContext();
      const memberPage = await ctx.newPage();
      await servePhotos(memberPage);
      await loginAs(memberPage, member);
      await expectPhoto(memberPage, `/event/${eventId}`);
      await ctx.close();
    }
  });
});
