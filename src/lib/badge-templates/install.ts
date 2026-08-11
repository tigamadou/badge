import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { deletePrefix, uploadFile } from "@/lib/storage";
import { parseManifest } from "./declarative/schema";
import type { TemplateManifest } from "./declarative/manifest-types";
import type { PackageAsset } from "./package-reader";
import { renderProof } from "./render-proof";

export const REFERENCE_DIR = "prisma/badge-templates";

export type InstallResult = { id: string; family: string; version: number };

// Chemin d'installation commun a la route de televersement et au seed. Un template
// de base n'est donc pas un cas privilegie : il subit la meme validation, le meme
// rendu d'epreuve et la meme generation d'apercu qu'un paquet televerse.
export async function installTemplate(args: {
  manifest: TemplateManifest;
  assets: PackageAsset[];
  installedById: string;
}): Promise<InstallResult> {
  const { manifest, assets, installedById } = args;

  const previous = await prisma.installedBadgeTemplate.findFirst({
    where: { family: manifest.family },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (previous?.version ?? 0) + 1;

  // L'identifiant est genere en amont : il compose le prefixe de stockage, ce qui
  // permet de nettoyer les ressources si le rendu d'epreuve echoue.
  const id = crypto.randomUUID();
  const assetPrefix = `badge-templates/${id}/`;

  let preview: Buffer;
  try {
    preview = await renderProof(manifest, assets, id);
  } catch (err) {
    /* v8 ignore next -- rien n'a encore ete ecrit sous ce prefixe a ce stade */
    await deletePrefix(assetPrefix).catch(() => undefined);
    throw err;
  }

  for (const asset of assets) {
    await uploadFile(`${assetPrefix}${asset.path}`, asset.body, asset.contentType);
  }
  const proofPath = `${assetPrefix}proof.pdf`;
  await uploadFile(proofPath, preview, "application/pdf");
  // L'apercu affiche est l'image fournie par le paquet ; le PDF ne sert plus que de
  // preuve d'impression, telechargeable depuis la page de detail.
  const previewPath = manifest.preview ? `${assetPrefix}${manifest.preview}` : null;

  const created = await prisma.installedBadgeTemplate.create({
    data: {
      id,
      family: manifest.family,
      version,
      label: manifest.label,
      description: manifest.description,
      pages: manifest.page.count,
      pageWidthMm: manifest.page.widthMm,
      pageHeightMm: manifest.page.heightMm,
      layout: manifest as unknown as object,
      assetPrefix,
      previewPath,
      proofPath,
      formatVersion: manifest.formatVersion,
      installedById,
    },
    select: { id: true, family: true, version: true },
  });

  return created;
}

function readReferencePackage(family: string): { manifest: TemplateManifest; assets: PackageAsset[] } {
  const dir = resolve(REFERENCE_DIR, family);
  const raw = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));

  // Les paquets de reference sont versionnes en arborescence, pas en archive : une
  // arborescence se relit et se compare en revue, la ou un ZIP binaire serait opaque.
  /* v8 ignore start -- aucun paquet livre n'embarque de ressource a ce jour : la
     branche existe pour qu'un futur paquet de reference puisse en avoir */
  const assetsDir = join(dir, "assets");
  const assets: PackageAsset[] = existsSync(assetsDir)
    ? readdirSync(assetsDir).map((name) => ({
        path: `assets/${name}`,
        body: readFileSync(join(assetsDir, name)),
        contentType: name.endsWith(".png") ? "image/png" : "image/jpeg",
      }))
    : [];
  const assetPaths = assets.map((a) => a.path);
  /* v8 ignore stop */

  const parsed = parseManifest(raw, assetPaths);
  /* v8 ignore start -- garde contre un paquet corrompu dans le depot ; la validite des
     manifestes livres est verifiee par reference-packages.test.ts */
  if (!parsed.ok) {
    throw new Error(`paquet de reference "${family}" invalide : ${parsed.errors.join(" | ")}`);
  }
  /* v8 ignore stop */
  return { manifest: parsed.manifest, assets };
}

// Installe les templates livres avec l'application s'ils sont absents. IDEMPOTENT :
// une famille deja presente est ignoree, sans lecture ni rendu. C'est ici que vit
// desormais la garantie qu'un template par defaut existe toujours -- garantie qui
// etait portee par le @default("default-v1") de PlatformSettings.badgeTemplateId.
export async function ensureReferenceTemplates(installedById: string): Promise<void> {
  const families = readdirSync(resolve(REFERENCE_DIR), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  for (const family of families) {
    const existing = await prisma.installedBadgeTemplate.count({ where: { family } });
    if (existing > 0) continue;
    const { manifest, assets } = readReferencePackage(family);
    await installTemplate({ manifest, assets, installedById });
  }
}

// Version courante d'une famille donnee.
export async function familyTemplateId(family: string): Promise<string | null> {
  const row = await prisma.installedBadgeTemplate.findFirst({
    where: { family },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  return row?.id ?? null;
}

// Version courante de la famille `default`, sur laquelle repose le repli.
export async function defaultTemplateId(): Promise<string | null> {
  return familyTemplateId("default");
}
