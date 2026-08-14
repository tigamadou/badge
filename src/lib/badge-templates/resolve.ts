import type { InstalledBadgeTemplate } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFile } from "@/lib/storage";
import type { BadgeTemplate } from "./types";
import { buildDeclarativeTemplate, type AssetResolver } from "./declarative";
import type { Block, TemplateManifest } from "./declarative/manifest-types";

export type TemplateSummary = {
  id: string;
  label: string;
  description: string;
  pages: number;
  pageSize: { width: string; height: string };
  previewSrc: string;
};

// Famille livree avec l'application, installee par le seed. Elle sert de repli quand
// un identifiant ne designe plus rien.
export const DEFAULT_FAMILY = "default";

// L'apercu d'un template installe est un PDF stocke. Il est servi par
// /api/files/[...path], qui traite les cles `badge-templates/` comme non sensibles.
// Le chemin nu de stockage n'est pas affichable tel quel cote client.
export function previewUrl(previewPath: string | null): string {
  return previewPath ? `/api/files/${previewPath}` : "";
}

// Noms de ressources referencees par un layout : fonds image des formes et fichiers
// de police. Sert a precharger avant construction, `AssetResolver` etant synchrone.
function referencedAssets(manifest: TemplateManifest): string[] {
  const fromBlocks = manifest.blocks
    .filter(
      (b: Block): b is Extract<Block, { type: "rect" | "square" | "circle" }> =>
        b.type === "rect" || b.type === "square" || b.type === "circle",
    )
    .map((b) => b.image?.asset)
    .filter((a): a is string => typeof a === "string");
  const fromFonts = (manifest.fonts ?? []).map((f) => f.file);
  return [...new Set([...fromBlocks, ...fromFonts])];
}

async function loadAssetResolver(row: InstalledBadgeTemplate): Promise<AssetResolver> {
  const manifest = row.layout as unknown as TemplateManifest;
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

async function buildFromRow(row: InstalledBadgeTemplate): Promise<BadgeTemplate> {
  const manifest = row.layout as unknown as TemplateManifest;
  const assets = await loadAssetResolver(row);
  const template = buildDeclarativeTemplate(manifest, assets, row.id);
  return {
    ...template,
    meta: { ...template.meta, previewSrc: previewUrl(row.previewPath) },
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

  return [...latestByFamily.values()].map((row) => ({
    id: row.id,
    label: row.label,
    description: row.description,
    pages: row.pages,
    pageSize: { width: `${row.pageWidthPx}px`, height: `${row.pageHeightPx}px` },
    previewSrc: previewUrl(row.previewPath),
  }));
}
