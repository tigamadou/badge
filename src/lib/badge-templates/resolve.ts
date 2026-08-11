import type { InstalledBadgeTemplate } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFile } from "@/lib/storage";
import { BADGE_TEMPLATES, DEFAULT_TEMPLATE_ID, getTemplate, listTemplates } from "./index";
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

// L'apercu d'un template installe est un PDF stocke. Il est servi par
// /api/files/[...path], qui traite les cles `badge-templates/` comme non sensibles.
// Le chemin nu de stockage n'est pas affichable tel quel cote client.
export function previewUrl(previewPath: string | null): string {
  return previewPath ? `/api/files/${previewPath}` : "";
}

// Noms de ressources referencees par un layout : assets des blocs image et fichiers
// de police. Sert a precharger avant construction, `AssetResolver` etant synchrone.
function referencedAssets(manifest: TemplateManifest): string[] {
  const fromBlocks = manifest.blocks
    .filter((b: Block): b is Extract<Block, { type: "image" }> => b.type === "image")
    .map((b) => b.asset)
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

// Resout un identifiant, quelle que soit son origine. Un template ARCHIVE reste
// resolvable : c'est ce qui fige les badges des evenements deja configures. Le filtre
// sur `archived` n'a lieu que dans listAvailableTemplates.
export async function resolveTemplate(id: string): Promise<BadgeTemplate> {
  const fromRegistry = getTemplate(id);
  if (fromRegistry) return fromRegistry;

  const row = await prisma.installedBadgeTemplate.findUnique({ where: { id } });
  if (row) return buildFromRow(row);

  console.warn(`[badge-templates] templateId "${id}" introuvable -- repli sur "${DEFAULT_TEMPLATE_ID}"`);
  return getTemplate(DEFAULT_TEMPLATE_ID)!;
}

// Distincte de resolveTemplate, qui retombe toujours sur le defaut : ici on veut
// savoir si l'identifiant designe reellement un template, pour valider une saisie.
export async function templateExists(id: string): Promise<boolean> {
  if (getTemplate(id)) return true;
  const count = await prisma.installedBadgeTemplate.count({ where: { id } });
  return count > 0;
}

// Ce qui est PROPOSABLE : le registre, plus la version la plus recente de chaque
// famille non archivee.
export async function listAvailableTemplates(): Promise<TemplateSummary[]> {
  const rows = await prisma.installedBadgeTemplate.findMany({
    where: { archived: false },
    orderBy: [{ family: "asc" }, { version: "desc" }],
  });

  const latestByFamily = new Map<string, InstalledBadgeTemplate>();
  for (const row of rows) {
    if (!latestByFamily.has(row.family)) latestByFamily.set(row.family, row);
  }

  const fromRegistry: TemplateSummary[] = listTemplates().map((t) => ({
    id: t.meta.id,
    label: t.meta.label,
    description: t.meta.description,
    pages: t.meta.pages,
    pageSize: t.meta.pageSize,
    previewSrc: t.meta.previewSrc,
  }));

  const fromDatabase: TemplateSummary[] = [...latestByFamily.values()].map((row) => ({
    id: row.id,
    label: row.label,
    description: row.description,
    pages: row.pages,
    pageSize: { width: `${row.pageWidthMm}mm`, height: `${row.pageHeightMm}mm` },
    previewSrc: previewUrl(row.previewPath),
  }));

  return [...fromRegistry, ...fromDatabase];
}

// Un `family` installe ne doit jamais masquer un identifiant du registre compile.
export function collidesWithRegistry(family: string): boolean {
  return Object.keys(BADGE_TEMPLATES).includes(family);
}
