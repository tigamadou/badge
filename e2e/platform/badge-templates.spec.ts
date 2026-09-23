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
    formatVersion: 2,
    family,
    label: "Badge E2E",
    description: "Template installe par un test e2e.",
    page: { widthPx: 1011, heightPx: 638, count: 1 },
    variables: [
      { name: "participant.firstName", kind: "text", label: "Prénom", sample: "Awa" },
      { name: "structure", kind: "text", label: "Structure", sample: "Organisation" },
    ],
    blocks: [
      {
        type: "text",
        page: 1,
        x: 4,
        y: 4,
        w: 400,
        h: 60,
        text: "{participant.firstName} — {structure}",
        style: { sizePx: 50, color: "#0f172a", overflow: "clip" },
      },
    ],
  });
}

// Depose l'archive, traverse l'ecran de liaison (la seule variable non suggeree,
// "structure", est liee a participant.structure) et lance l'installation. Les
// tests qui n'examinent pas l'ecran de liaison en detail passent par ce raccourci.
async function installViaUi(page: Page, archive: string) {
  await page.setInputFiles('input[type="file"]', archive);
  await expect(page.getByRole("heading", { name: /liaisons des variables/i })).toBeVisible({
    timeout: 15_000,
  });
  await page
    .getByRole("combobox", { name: "Source de la variable structure" })
    .selectOption("participant.structure");
  await page.getByRole("button", { name: "Installer" }).click();
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
    await expect(page.getByRole("heading", { name: /liaisons des variables/i })).toBeVisible({
      timeout: 15_000,
    });

    // participant.firstName est suggeree d'office (identite nom-source) ; structure
    // reste a decider, et le bouton refuse de s'activer tant que ce n'est pas fait.
    // Chaque select porte un aria-label nommant sa variable : la cible directement,
    // sans ambiguite avec les options qu'il propose (memes sources pour les deux
    // variables, toutes deux de type texte).
    const firstNameSelect = page.getByRole("combobox", {
      name: "Source de la variable participant.firstName",
    });
    await expect(firstNameSelect).toHaveValue("participant.firstName");

    // La table montre nom, libelle et type (en francais) de chaque variable.
    const firstNameRow = page.getByRole("row").filter({ has: firstNameSelect });
    await expect(firstNameRow.getByRole("cell").nth(0)).toHaveText("participant.firstName");
    await expect(firstNameRow.getByRole("cell").nth(1)).toHaveText("Prénom");
    await expect(firstNameRow.getByRole("cell").nth(2)).toHaveText("texte");

    const installButton = page.getByRole("button", { name: "Installer" });
    await expect(installButton).toBeDisabled();

    const structureSelect = page.getByRole("combobox", { name: "Source de la variable structure" });
    await structureSelect.selectOption("participant.structure");
    await expect(installButton).toBeEnabled();
    await installButton.click();

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
    // Ce paquet ne declare pas d'image : le catalogue montrera le placeholder. Le PDF
    // d'epreuve, lui, est toujours produit — c'est la preuve que le paquet s'imprime.
    expect(installed?.previewPath).toBeNull();
    expect(installed?.proofPath).toBeTruthy();

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
    await expect(page.getByTestId("install-success")).toBeVisible({ timeout: 15_000 });

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
    await expect(page.getByTestId("install-success")).toBeVisible({ timeout: 15_000 });

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
    await expect(page.getByTestId("install-success")).toBeVisible({ timeout: 15_000 });

    const prisma = getDb();
    const installed = await prisma.installedBadgeTemplate.findFirst({ where: { family } });
    // L'image devient l'apercu ; le PDF reste produit comme preuve d'impression.
    expect(installed?.previewPath).toBe(`badge-templates/${installed!.id}/assets/apercu.png`);
    expect(installed?.proofPath).toBe(`badge-templates/${installed!.id}/proof.pdf`);

    await page.goto(`/platform/badge-templates/${installed!.id}`);
    await expect(page).toHaveURL(new RegExp(`/platform/badge-templates/${installed!.id}`));
    // Sur le detail, l'apercu est le PDF d'epreuve : le rendu reel, affiche
    // directement. L'image fournie sert de vignette au catalogue.
    await expect(page.locator(`object[data="/api/files/${installed!.proofPath}"]`)).toHaveCount(1);
  });

  test("une seconde inspection en echec efface la precedente", async ({ page }) => {
    const family = `e2e-reinspect-${Date.now()}`;
    const valide = await writeArchive(`${family}.zip`, { "manifest.json": manifestOf(family) });
    const invalide = await writeArchive(`${family}-invalide.zip`, {
      "assets/fond.png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    });

    const staff = await createTestStaff({ role: "STAFF_ADMIN", scope: "bt-reinspect" });
    await loginAs(page, staff);
    await page.goto("/platform/badge-templates");

    await page.setInputFiles('input[type="file"]', valide);
    await expect(page.getByRole("heading", { name: /liaisons des variables/i })).toBeVisible({
      timeout: 15_000,
    });

    // Le second fichier est refuse : l'ecran de liaison du premier ne doit pas
    // rester arme, sinon « Installer » enverrait l'ancien fichier.
    await page.setInputFiles('input[type="file"]', invalide);
    await expect(page.getByTestId("install-errors")).toContainText(/le paquet a été refusé/i, {
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: /liaisons des variables/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Installer" })).toHaveCount(0);
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
