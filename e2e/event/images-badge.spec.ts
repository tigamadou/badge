import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestPrintRequest,
  createTestRegistration,
  createTestUser,
  disconnectDb,
  getDb,
  makeEventAdminUser,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";
import { ensureFixtures } from "../fixtures";
import { confirmCrop, installFramedTemplate, seedEventImage } from "../helpers/images-2a";
import { encodePng } from "../../prisma/seed/demo/png";

// Images du badge : cadre du template (logo/banniere), blocage de generation, recadrage.
// Role : ADMIN d'evenement.

const png = (w: number, h: number) => encodePng(w, h, (x, y) => [x % 255, y % 255, 120]);

async function setup(scope: string) {
  const { orgId, eventId, categoryId } = await createTestEvent({ scope });
  const admin = await makeEventAdminUser({ scope, eventId, orgId });
  const participant = await createTestUser({ scope: `${scope}-p`, verified: true, profile: true });
  const reg = await createTestRegistration({ eventId, userId: participant.id, categoryId, status: "APPROVED" });
  return { orgId, eventId, admin, reg };
}

test.describe("Event — Images du badge", () => {
  // Rendu PDF par le service Chromium + connexions multiples : large marge sous charge.
  test.describe.configure({ timeout: 180_000 });

  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("un envoi direct hors cadre est rejete avec un message", async ({ page }) => {
    const { orgId, eventId, admin } = await setup("imgb-reject");
    await installFramedTemplate({ adminId: admin.id, eventId, logo: { w: 68, h: 68 } });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    const fixtures = ensureFixtures();

    const res = await page.request.post(`/api/org/${orgId}/upload?purpose=logo&eventId=${eventId}`, {
      multipart: { file: { name: "tiny.jpg", mimeType: "image/jpeg", buffer: readFileSync(fixtures.tiny) } },
    });
    expect([400, 422]).toContain(res.status());
    const body = await res.json();
    expect(body.message ?? body.error).toBeTruthy();
    expect(body.code).toBeTruthy();
  });

  test("un changement de template bloque la generation jusqu'au recadrage", async ({ page }) => {
    const { orgId, eventId, admin, reg } = await setup("imgb-block");
    const square = png(136, 136);
    await installFramedTemplate({ adminId: admin.id, eventId, logo: { w: 68, h: 68 } });
    await seedEventImage(eventId, "logo", square, { w: 136, h: 136 });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    const pdfUrl = `/api/org/${orgId}/events/${eventId}/badges/${reg.id}`;
    await page.goto(`/event/${eventId}`);
    await expect(page.getByText("Images à recadrer")).toHaveCount(0);
    expect((await page.request.get(pdfUrl)).status()).toBe(200);

    // Le template passe en 3:1 : le logo 1:1 devient non conforme.
    await installFramedTemplate({ adminId: admin.id, eventId, logo: { w: 90, h: 30 } });
    await page.goto(`/event/${eventId}`);
    await expect(page.getByText("Images à recadrer")).toBeVisible();

    const blocked = await page.request.get(pdfUrl);
    expect(blocked.status()).toBe(422);
    expect((await blocked.json()).code).toBe("EVENT_IMAGES_NONCOMPLIANT");

    // Aperçu HTML : jamais bloqué, mais signalé.
    const preview = await page.request.get(`${pdfUrl}?format=html`);
    expect(preview.status()).toBe(200);
    expect(preview.headers()["x-event-images"]).toBe("noncompliant");

    // Commande d'impression : refusée à l'envoi.
    const request = await createTestPrintRequest({ eventId, orgId, createdById: admin.id, status: "DRAFT" });
    const submit = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/print-requests/${request.id}/submit`,
    );
    expect(submit.status()).toBe(422);
    expect((await submit.json()).code).toBe("EVENT_IMAGES_NONCOMPLIANT");
  });

  test("Recadrer l'image existante leve le blocage sans renvoyer de fichier", async ({ page }) => {
    const { orgId, eventId, admin, reg } = await setup("imgb-recrop");
    await installFramedTemplate({ adminId: admin.id, eventId, logo: { w: 90, h: 30 } });
    await seedEventImage(eventId, "logo", png(300, 300), { w: 300, h: 300 });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    const pdfUrl = `/api/org/${orgId}/events/${eventId}/badges/${reg.id}`;
    expect((await page.request.get(pdfUrl)).status()).toBe(422);

    await page.goto(`/event/${eventId}/settings`);
    await page.getByRole("button", { name: "Recadrer" }).first().click();
    await confirmCrop(page);
    await page.getByRole("button", { name: /^enregistrer$/i }).first().click();

    await expect(async () => {
      const fresh = await getDb().event.findUniqueOrThrow({ where: { id: eventId } });
      expect(fresh.logoWidth).toBeGreaterThan(0);
      expect(Math.abs(fresh.logoWidth! / fresh.logoHeight! - 3)).toBeLessThan(0.06);
    }).toPass();

    await page.goto(`/event/${eventId}`);
    await expect(page.getByText("Images à recadrer")).toHaveCount(0);
    expect((await page.request.get(pdfUrl)).status()).toBe(200);
  });

  test("les pages restent lisibles et le dialogue de cadrage atteignable à 375, 1024 et 1280 px", async ({ page }) => {
    const { eventId, admin } = await setup("imgb-resp");
    await installFramedTemplate({ adminId: admin.id, eventId, logo: { w: 68, h: 68 } });
    await seedEventImage(eventId, "logo", png(300, 100), { w: 300, h: 100 });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    for (const width of [375, 1024, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of [`/event/${eventId}`, `/event/${eventId}/settings`]) {
        await page.goto(path);
        await expect(page.getByText(/images à recadrer|logo/i).first()).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${path} à ${width}px`).toBeLessThanOrEqual(0);
      }

      await page.getByRole("button", { name: "Recadrer" }).first().click();
      await expect(page.getByRole("button", { name: "Valider le cadrage" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Annuler" })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `dialogue à ${width}px`).toBeLessThanOrEqual(0);
      await page.getByRole("button", { name: "Annuler" }).click();
    }
  });
});
