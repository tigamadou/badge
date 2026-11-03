import type { InstalledBadgeTemplate, Prisma } from "@prisma/client";
import type { VariableDeclaration } from "@tigamadou/pdf-engine";
import { prisma } from "@/lib/prisma";
import { resolveBadgeTemplateId } from "@/lib/settings";
import { DEFAULT_FAMILY } from "./resolve";
import type { Bindings } from "./bindings";

// Lit le badgeTemplateId de PlatformSettings (singleton). En son absence, on rend une
// chaine vide : l'identifiant sera traite comme inconnu et on retombera sur la
// famille `default`.
async function getPlatformBadgeTemplateId(db: Prisma.TransactionClient): Promise<{ badgeTemplateId: string }> {
  const platform = await db.platformSettings.findUnique({
    where: { id: "singleton" },
    select: { badgeTemplateId: true },
  });
  return platform ?? { badgeTemplateId: "" };
}

// Identifiant effectif d'un evenement : evenement -> organisation -> plateforme.
export async function resolveEventTemplateId(event: {
  badgeTemplateId: string | null;
  orgId: string;
}, db: Prisma.TransactionClient = prisma): Promise<string> {
  const [organization, platform] = await Promise.all([
    db.organization.findUnique({ where: { id: event.orgId }, select: { badgeTemplateId: true } }),
    getPlatformBadgeTemplateId(db),
  ]);
  return resolveBadgeTemplateId({ badgeTemplateId: event.badgeTemplateId }, organization, platform);
}

export async function findEffectiveTemplateRow(
  id: string,
  db: Prisma.TransactionClient = prisma,
): Promise<InstalledBadgeTemplate | null> {
  const row = await db.installedBadgeTemplate.findUnique({ where: { id } });
  if (row) return row;
  return db.installedBadgeTemplate.findFirst({
    where: { family: DEFAULT_FAMILY },
    orderBy: { version: "desc" },
  });
}

const NONE = { variables: [] as VariableDeclaration[], bindings: {} as Bindings };

// Variables et liaisons du template effectif d'un evenement, sans charger aucune
// ressource (polices, images). Destine aux ecrans qui n'ont besoin que de la liste
// des options : un template cassé ne doit pas les faire tomber. En cas d'echec on
// rend « aucune variable » et on journalise.
export async function resolveEventTemplateVariables(event: {
  badgeTemplateId: string | null;
  orgId: string;
}): Promise<{ variables: VariableDeclaration[]; bindings: Bindings }> {
  try {
    const row = await findEffectiveTemplateRow(await resolveEventTemplateId(event));
    if (!row) {
      console.warn(`[badge-templates] aucun template lisible pour les options (famille "${DEFAULT_FAMILY}" absente)`);
      return NONE;
    }
    const layout = row.layout as { variables?: unknown } | null;
    if (!layout || typeof layout !== "object" || !Array.isArray(layout.variables)) {
      console.warn(`[badge-templates] layout illisible pour "${row.id}" : options ignorees`);
      return NONE;
    }
    const bindings =
      row.bindings !== null && typeof row.bindings === "object" && !Array.isArray(row.bindings)
        ? (row.bindings as Bindings)
        : {};
    return { variables: layout.variables as VariableDeclaration[], bindings };
  } catch (err) {
    console.warn("[badge-templates] lecture des options du template impossible :", err);
    return NONE;
  }
}
