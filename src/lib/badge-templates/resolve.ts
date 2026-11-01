import type { InstalledBadgeTemplate } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFile } from "@/lib/storage";
import type { BadgeTemplate } from "./types";
import {
  migrateManifest as migrateToV3,
  type AssetResolver,
  type Block,
  type TemplateManifest,
} from "@tigamadou/pdf-engine";
import { getOnsitePrintSettings } from "@/lib/settings";
import { validateBindings, type Bindings } from "./bindings";

export const CURRENT_FORMAT = 3;

export type TemplateSummary = {
  id: string;
  label: string;
  description: string;
  pages: number;
  pageSize: { width: string; height: string };
  previewSrc: string;
  // Plan 35 : template propose pour l'impression sur place (reglages plateforme).
  onsite: boolean;
};

// Famille livree avec l'application, installee par le seed. Elle sert de repli quand
// un identifiant ne designe plus rien.
export const DEFAULT_FAMILY = "default";

// L'apercu d'un template installe est une image stockee. Elle est servie par
// /api/files/[...path], qui traite les cles `badge-templates/` comme non sensibles.
// Le chemin nu de stockage n'est pas affichable tel quel cote client.
export function previewUrl(previewPath: string | null): string {
  return previewPath ? `/api/files/${previewPath}` : "";
}

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp)$/i;

// Premiere source affichable comme image, dans l'ordre demande ; "" si aucune. Une
// epreuve .pdf d'avant la migration vers le format 3 n'est pas une image.
export function templateImageUrl(
  row: { previewPath: string | null; proofPath: string | null },
  prefer: "preview" | "proof",
): string {
  const ordered = prefer === "preview" ? [row.previewPath, row.proofPath] : [row.proofPath, row.previewPath];
  const path = ordered.find((p): p is string => p !== null && IMAGE_EXTENSIONS.test(p));
  return path ? previewUrl(path) : "";
}

// Ressources des blocs d'un arbre : fonds image des formes et images des puces de
// liste. Descend dans les groupes, a toute profondeur : une ressource posee dans un
// groupe doit etre prechargee comme les autres.
function blockAssets(blocks: Block[]): string[] {
  return blocks.flatMap((b): string[] => {
    if (b.type === "group") return blockAssets(b.blocks);
    if (b.type === "text") return [];
    if (b.type === "list") {
      return b.bullet.type === "image" && b.bullet.asset ? [b.bullet.asset] : [];
    }
    // Seules les formes pleines (rect, square, circle, ellipse) portent une image.
    return "image" in b && b.image?.asset ? [b.image.asset] : [];
  });
}

// Noms de ressources referencees par un layout : ressources des blocs et fichiers
// de police. Sert a precharger avant construction, `AssetResolver` etant synchrone.
export function referencedAssets(manifest: TemplateManifest): string[] {
  const fromBlocks = blockAssets(manifest.blocks);
  const fromFonts = (manifest.fonts ?? []).map((f) => f.file);
  return [...new Set([...fromBlocks, ...fromFonts])];
}

// Format 3 : tel quel. Format 2 : renumerote en memoire (le layout a ete valide a
// l'installation), ce qui laisse les badges s'imprimer entre le deploiement et la
// migration des lignes. Tout autre format est refuse.
export function readLayout(
  row: Pick<InstalledBadgeTemplate, "id" | "formatVersion" | "layout">,
): TemplateManifest {
  if (row.formatVersion === CURRENT_FORMAT) return row.layout as unknown as TemplateManifest;
  if (row.formatVersion === 2) return migrateToV3(row.layout) as TemplateManifest;
  throw new Error(
    `resolveTemplate : le template "${row.id}" est encore au format v${row.formatVersion}. Migrer les templates installés (make migrate-installed-templates).`,
  );
}

async function loadAssetResolver(
  row: InstalledBadgeTemplate,
  manifest: TemplateManifest,
): Promise<AssetResolver> {
  const names = referencedAssets(manifest);
  const entries = await Promise.all(
    names.map(async (name) => {
      const file = await getFile(`${row.assetPrefix}${name}`);
      return [name, `data:${file.contentType};base64,${file.body.toString("base64")}`] as const;
    }),
  );
  const map = new Map(entries);
  return (name: string) => {
    const url = map.get(name);
    /* v8 ignore next -- la map contient exactement les noms references par le
       manifeste (referencedAssets) : ce cas suppose un layout incoherent */
    if (!url) throw new Error(`resolveTemplate : ressource "${name}" absente du stockage`);
    return url;
  };
}

// La colonne JSON peut contenir n'importe quoi (scalaire, tableau) si elle a ete
// ecrite a la main. Tout ce qui n'est pas un objet simple vaut « aucune liaison » :
// validateBindings le signalera, sans empecher l'impression.
function readBindings(value: unknown): Bindings {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Bindings)
    : {};
}

async function buildFromRow(row: InstalledBadgeTemplate): Promise<BadgeTemplate> {
  const manifest = readLayout(row);
  const bindings = readBindings(row.bindings);
  const assets = await loadAssetResolver(row, manifest);

  // Une table imparfaite ne doit JAMAIS empecher un badge de s'imprimer : l'ecran
  // d'installation et le script de migration garantissent la completude en amont,
  // ce journal n'est la que pour attraper la derive.
  const errors = validateBindings(manifest.variables, bindings);
  if (errors.length > 0) {
    console.warn(`[badge-templates] liaisons incompletes pour "${row.id}" : ${errors.join(" | ")}`);
  }

  return {
    meta: {
      id: row.id,
      version: row.version,
      label: row.label,
      description: row.description,
      pages: row.pages,
      pageSize: { width: `${row.pageWidthPx}px`, height: `${row.pageHeightPx}px` },
      previewSrc: templateImageUrl(row, "preview"),
    },
    manifest,
    variables: manifest.variables,
    bindings,
    assets,
  };
}

// Le repli ne peut plus viser une constante de code : il vise la famille `default`,
// dont le seed garantit l'existence. Une base sans template est une anomalie
// d'exploitation qu'il vaut mieux voir echouer bruyamment qu'imprimer un badge vide.
async function fallbackTemplate(): Promise<BadgeTemplate> {
  const row = await prisma.installedBadgeTemplate.findFirst({
    where: { family: DEFAULT_FAMILY },
    orderBy: { version: "desc" },
  });
  if (!row) {
    throw new Error(
      `resolveTemplate : aucune famille "${DEFAULT_FAMILY}" en base. Le seed n'a pas ete execute (make db-seed).`,
    );
  }
  return buildFromRow(row);
}

// Un template ARCHIVE reste resolvable : c'est ce qui fige les badges des evenements
// deja configures. Le filtre sur `archived` n'a lieu que dans listAvailableTemplates.
export async function resolveTemplate(id: string): Promise<BadgeTemplate> {
  const row = await prisma.installedBadgeTemplate.findUnique({ where: { id } });
  if (row) return buildFromRow(row);

  console.warn(
    `[badge-templates] templateId "${id}" introuvable -- repli sur la famille "${DEFAULT_FAMILY}"`,
  );
  return fallbackTemplate();
}

// Distincte de resolveTemplate, qui retombe toujours sur le defaut : ici on veut
// savoir si l'identifiant designe reellement un template, pour valider une saisie.
export async function templateExists(id: string): Promise<boolean> {
  return (await prisma.installedBadgeTemplate.count({ where: { id } })) > 0;
}

// Ce qui est PROPOSABLE : la version la plus recente de chaque famille non archivee.
export async function listAvailableTemplates(): Promise<TemplateSummary[]> {
  const rows = await prisma.installedBadgeTemplate.findMany({
    where: { archived: false },
    orderBy: [{ family: "asc" }, { version: "desc" }],
  });

  const latestByFamily = new Map<string, InstalledBadgeTemplate>();
  for (const row of rows) {
    if (!latestByFamily.has(row.family)) latestByFamily.set(row.family, row);
  }

  const onsiteIds = new Set((await getOnsitePrintSettings()).templateIds);

  return [...latestByFamily.values()].map((row) => ({
    id: row.id,
    label: row.label,
    description: row.description,
    pages: row.pages,
    pageSize: { width: `${row.pageWidthPx}px`, height: `${row.pageHeightPx}px` },
    previewSrc: templateImageUrl(row, "preview"),
    onsite: onsiteIds.has(row.id),
  }));
}
