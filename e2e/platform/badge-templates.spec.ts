import { test, expect, type Page } from "@playwright/test";
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
    formatVersion: 3,
    family,
    label: "Badge E2E",
    description: "Template installe par un test e2e.",
    category: "badge",
    page: { widthPx: 1011, heightPx: 638, count: 1 },
    variables: [
      { name: "participant.firstName", kind: "text", label: "Prénom", sample: "Awa" },
      { name: "participant.lastName", kind: "text", label: "Nom", sample: "Diallo" },
    ],
    blocks: [
      {
        type: "text",
        page: 1,
        x: 4,
        y: 4,
        w: 400,
        h: 60,
        text: "{participant.firstName} {participant.lastName}",
        style: { sizePx: 50, color: "#0f172a", overflow: "clip" },
      },
    ],
  });
}

// Ouvre la modale, depose l'archive, attend le recapitulatif puis lance l'installation
// et attend le message de succes. Ne ferme pas la modale.
async function installViaUi(page: Page, archive: string) {
  await page.getByRole("button", { name: "Installer un template", exact: true }).click();
  await page.setInputFiles('input[type="file"]', archive);
  await expect(page.getByText(/Données de badge/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Installer", exact: true }).click();
}

// Le bouton « Fermer » du recapitulatif suit, dans le DOM, la croix d'en-tete du dialogue.
function closeButton(page: Page) {
  return page.getByRole("button", { name: "Fermer", exact: true }).last();
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

    await page.getByRole("button", { name: "Installer un template", exact: true }).click();
    await page.setInputFiles('input[type="file"]', archive);

    // Le recapitulatif liste les donnees du contrat reconnues dans le paquet.
    await expect(page.getByText("Données de badge (2)")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(family).first()).toBeVisible();

    await page.getByRole("button", { name: "Installer", exact: true }).click();
    await expect(page.getByText("Template installé (version 1)")).toBeVisible({ timeout: 15_000 });
    await closeButton(page).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // La ligne apparait au catalogue apres router.refresh().
    await expect(page.getByText(family).first()).toBeVisible({ timeout: 15_000 });

    const prisma = getDb();
    const installed = await prisma.installedBadgeTemplate.findFirst({ where: { family } });
    expect(installed).not.toBeNull();
    expect(installed?.version).toBe(1);
    // Ce paquet ne declare pas d'image : la vignette du catalogue est l'epreuve PNG,
    // toujours produite — c'est la preuve que le paquet s'imprime.
    expect(installed?.previewPath).toBeNull();
    expect(installed?.proofPath).toBe(`badge-templates/${installed!.id}/proof.png`);

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

  test("le detail d'un template montre son apercu, ses versions et son manifeste", async ({
    page,
  }) => {
    const family = `e2e-detail-${Date.now()}`;
    const archive = await writeArchive(`${family}.zip`, { "manifest.json": manifestOf(family) });

    const staff = await createTestStaff({ role: "STAFF_ADMIN", scope: "bt-detail" });
    await loginAs(page, staff);

    await page.goto("/platform/badge-templates");
    await installViaUi(page, archive);
    await expect(page.getByText("Template installé (version 1)")).toBeVisible({ timeout: 15_000 });

    const prisma = getDb();
    const installed = await prisma.installedBadgeTemplate.findFirst({ where: { family } });

    await page.goto(`/platform/badge-templates/${installed!.id}`);
    await expect(page).toHaveURL(new RegExp(`/platform/badge-templates/${installed!.id}`));
    await expect(page.getByRole("heading", { name: /badge e2e/i })).toBeVisible();

    // Aucun evenement ne l'utilise encore : l'information doit etre affichee, pas masquee.
    await expect(page.getByText(/aucun évènement ni organisation/i)).toBeVisible();

    // La famille n'a qu'une version, et le manifeste est telechargeable.
    await expect(page.getByText(/versions de la famille/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /télécharger le manifeste/i })).toBeVisible();
  });

  test("le detail liste les evenements qui utilisent le template", async ({ page }) => {
    const family = `e2e-usage-${Date.now()}`;
    const archive = await writeArchive(`${family}.zip`, { "manifest.json": manifestOf(family) });

    const staff = await createTestStaff({ role: "STAFF_ADMIN", scope: "bt-usage" });
    await loginAs(page, staff);

    await page.goto("/platform/badge-templates");
    await installViaUi(page, archive);
    await expect(page.getByText("Template installé (version 1)")).toBeVisible({ timeout: 15_000 });

    const prisma = getDb();
    const installed = await prisma.installedBadgeTemplate.findFirst({ where: { family } });

    // Un evenement adopte ce template : le detail doit le nommer.
    const { eventId } = await createTestEvent({ scope: "bt-usage" });
    await prisma.event.update({
      where: { id: eventId },
      data: { badgeTemplateId: installed!.id },
    });
    const evenement = await prisma.event.findUnique({ where: { id: eventId } });

    await page.goto(`/platform/badge-templates/${installed!.id}`);
    await expect(page).toHaveURL(new RegExp(`/platform/badge-templates/${installed!.id}`));
    await expect(page.getByText(evenement!.title)).toBeVisible();
  });

  test("un template qui fournit une image l'affiche au lieu du placeholder", async ({ page }) => {
    const family = `e2e-image-${Date.now()}`;
    const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const manifest = JSON.parse(manifestOf(family));
    manifest.preview = "assets/apercu.png";

    const archive = await writeArchive(`${family}.zip`, {
      "manifest.json": JSON.stringify(manifest),
      "assets/apercu.png": PNG,
    });

    const staff = await createTestStaff({ role: "STAFF_ADMIN", scope: "bt-image" });
    await loginAs(page, staff);

    await page.goto("/platform/badge-templates");
    await installViaUi(page, archive);
    await expect(page.getByText("Template installé (version 1)")).toBeVisible({ timeout: 15_000 });

    const prisma = getDb();
    const installed = await prisma.installedBadgeTemplate.findFirst({ where: { family } });
    // L'image devient l'apercu du catalogue ; l'epreuve PNG reste produite.
    expect(installed?.previewPath).toBe(`badge-templates/${installed!.id}/assets/apercu.png`);
    expect(installed?.proofPath).toBe(`badge-templates/${installed!.id}/proof.png`);

    await page.goto(`/platform/badge-templates/${installed!.id}`);
    await expect(page).toHaveURL(new RegExp(`/platform/badge-templates/${installed!.id}`));
    // Sur le detail, l'apercu est l'epreuve PNG : le rendu reel. L'image fournie sert de
    // vignette au catalogue.
    await expect(page.locator('img[alt="Aperçu Badge E2E"]')).toHaveCount(1);
    await expect(page.locator("object")).toHaveCount(0);
  });

  test("une archive invalide est refusee avec ses erreurs, sans rien installer", async ({ page }) => {
    const archive = await writeArchive(`e2e-invalide-${Date.now()}.zip`, {
      "assets/fond.png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    });

    const staff = await createTestStaff({ role: "STAFF_ADMIN", scope: "bt-invalide" });
    await loginAs(page, staff);

    await page.goto("/platform/badge-templates");
    const before = await getDb().installedBadgeTemplate.count();

    await page.getByRole("button", { name: "Installer un template", exact: true }).click();
    await page.setInputFiles('input[type="file"]', archive);
    await expect(page.getByRole("dialog").getByText(/manifest\.json/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Choisir un autre fichier" })).toBeVisible();
    await expect(page.getByText(/Données de badge/)).toHaveCount(0);

    expect(await getDb().installedBadgeTemplate.count()).toBe(before);
  });

  test("une archive a ancien nom de variable est refusee avec le nom attendu", async ({ page }) => {
    const family = `e2e-legacy-${Date.now()}`;
    const manifest = JSON.parse(manifestOf(family));
    manifest.variables[0] = { name: "firstName", kind: "text", label: "Prénom", sample: "Awa" };
    manifest.blocks[0].text = "{firstName} {participant.lastName}";
    const archive = await writeArchive(`${family}.zip`, { "manifest.json": JSON.stringify(manifest) });

    const staff = await createTestStaff({ role: "STAFF_ADMIN", scope: "bt-legacy" });
    await loginAs(page, staff);
    await page.goto("/platform/badge-templates");

    await page.getByRole("button", { name: "Installer un template", exact: true }).click();
    await page.setInputFiles('input[type="file"]', archive);
    await expect(page.getByRole("dialog")).toContainText(
      /ancien nom, réexporter le template depuis le studio/i,
      { timeout: 15_000 },
    );
    await expect(page.getByRole("dialog")).toContainText("participant.firstName");
    expect(await getDb().installedBadgeTemplate.count({ where: { family } })).toBe(0);
  });

  test("un fichier .pdf est refuse localement, sans requete d'analyse", async ({ page }) => {
    const pdf = join(TMP, `e2e-refus-${Date.now()}.pdf`);
    writeFileSync(pdf, "%PDF-1.4\n");

    const staff = await createTestStaff({ role: "STAFF_ADMIN", scope: "bt-pdf" });
    await loginAs(page, staff);
    await page.goto("/platform/badge-templates");

    let inspectRequests = 0;
    page.on("request", (req) => {
      if (req.url().includes("/api/platform/badge-templates/inspect")) inspectRequests++;
    });

    await page.getByRole("button", { name: "Installer un template", exact: true }).click();
    await page.setInputFiles('input[type="file"]', pdf);
    await expect(page.getByText("Seules les archives .zip sont acceptées.")).toBeVisible();
    expect(inspectRequests).toBe(0);
  });

  test("un STAFF_OBSERVER consulte le catalogue sans pouvoir installer", async ({ page }) => {
    const staff = await createTestStaff({ role: "STAFF_OBSERVER", scope: "bt-observer" });
    await loginAs(page, staff);

    await page.goto("/platform/badge-templates");
    await expect(page).toHaveURL(/\/platform\/badge-templates/);
    await expect(page.getByRole("heading", { name: /templates de badge/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Installer un template", exact: true })).toHaveCount(0);
  });
});
