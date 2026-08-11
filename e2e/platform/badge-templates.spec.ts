import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { cleanupE2ETestData, createTestEvent, getDb, disconnectDb } from "../helpers/db";
import { loginAs, loginAsEventMember } from "../helpers/auth";
import { createTestStaff } from "../helpers/db";

const TMP = "/tmp";

// Construit une archive de template a la volee : aucun binaire versionne dans le depot.
async function writeArchive(name: string, files: Record<string, Buffer | string>): Promise<string> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const target = join(TMP, name);
  writeFileSync(target, buffer);
  return target;
}

function manifestOf(family: string) {
  return JSON.stringify({
    formatVersion: 1,
    family,
    label: "Badge E2E",
    description: "Template installe par un test e2e.",
    page: { widthMm: 85.6, heightMm: 54, count: 1 },
    blocks: [
      {
        type: "rect",
        page: 1,
        x: 0,
        y: 46,
        w: 85.6,
        h: 8,
        fill: "category.color",
      },
      {
        type: "text",
        page: 1,
        x: 4,
        y: 6,
        w: 60,
        h: 8,
        text: "{participant.firstName} {participant.lastName}",
        style: { sizePt: 12, weight: 700, color: "#0f172a", overflow: "clip" },
      },
      { type: "qr", page: 1, x: 64, y: 28, w: 16, h: 16 },
    ],
  });
}

test.describe("Platform — Templates de badge", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("STAFF_ADMIN installe une archive et un evenement l'utilise", async ({ page }) => {
    const family = `e2e-install-${Date.now()}`;
    const archive = await writeArchive(`${family}.zip`, { "manifest.json": manifestOf(family) });

    const staff = await createTestStaff({ role: "STAFF_ADMIN", scope: "bt-install" });
    await loginAs(page, staff);

    await page.goto("/platform/badge-templates");
    await expect(page).toHaveURL(/\/platform\/badge-templates/);
    await expect(page.getByRole("heading", { name: /templates de badge/i })).toBeVisible();

    await page.setInputFiles('input[type="file"]', archive);
    // Cible le bandeau de succes de l'installeur : le nom de famille apparait aussi
    // dans la ligne ajoutee au catalogue.
    await expect(page.getByTestId("install-success")).toContainText(
      new RegExp(`${family}.*version 1`, "i"),
      { timeout: 15_000 },
    );

    const prisma = getDb();
    const installed = await prisma.installedBadgeTemplate.findFirst({ where: { family } });
    expect(installed).not.toBeNull();
    expect(installed?.version).toBe(1);
    expect(installed?.previewPath).toBeTruthy();

    // Un membre d'organisation peut le selectionner pour son evenement.
    const { orgId, eventId } = await createTestEvent({ scope: "bt-use" });
    await page.context().clearCookies();
    const member = await loginAsEventMember(page, {
      orgId,
      eventId,
      role: "ADMIN",
      scope: "bt-member",
    });
    expect(member.id).toBeTruthy();

    await page.goto(`/event/${eventId}/settings/badge`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/settings/badge`));
    // Cible la carte du template qu'on vient d'installer : d'autres runs ont pu en
    // laisser d'autres portant le meme libelle.
    const carte = page.getByTestId(`template-card-${installed!.id}`);
    await expect(carte).toBeVisible();
    await expect(carte).toContainText("Badge E2E");

    // Et il est selectionnable : c'est le but de l'installation.
    await page.getByTestId(`select-${installed!.id}`).click();
    await expect
      .poll(async () => (await prisma.event.findUnique({ where: { id: eventId } }))?.badgeTemplateId, {
        timeout: 10_000,
      })
      .toBe(installed!.id);
  });

  test("une archive invalide est refusee avec ses erreurs", async ({ page }) => {
    const archive = await writeArchive(`e2e-invalide-${Date.now()}.zip`, {
      "assets/fond.png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    });

    const staff = await createTestStaff({ role: "STAFF_ADMIN", scope: "bt-invalide" });
    await loginAs(page, staff);

    await page.goto("/platform/badge-templates");
    const before = await getDb().installedBadgeTemplate.count();

    await page.setInputFiles('input[type="file"]', archive);
    // Le texte d'aide du formulaire mentionne aussi manifest.json, et Next expose son
    // propre role="alert" (route announcer) : on cible le bloc d'erreurs de l'installeur.
    const erreurs = page.getByTestId("install-errors");
    await expect(erreurs).toContainText(/le paquet a été refusé/i, { timeout: 15_000 });
    await expect(erreurs).toContainText(/manifest\.json/i);

    expect(await getDb().installedBadgeTemplate.count()).toBe(before);
  });

  test("un STAFF_OBSERVER consulte le catalogue sans pouvoir installer", async ({ page }) => {
    const staff = await createTestStaff({ role: "STAFF_OBSERVER", scope: "bt-observer" });
    await loginAs(page, staff);

    await page.goto("/platform/badge-templates");
    await expect(page).toHaveURL(/\/platform\/badge-templates/);
    await expect(page.getByRole("heading", { name: /templates de badge/i })).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });
});
