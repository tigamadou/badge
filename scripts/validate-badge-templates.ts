// v2-12, revu au plan v4-12, puis au moteur v2 (tache 7) : valide qu'aucun
// `badgeTemplateId` persiste en BDD ne reference un template inexistant, que
// chaque template installe est bien au format v2 (le moteur ne sait plus rendre
// du v1) et que ses liaisons couvrent integralement ses variables. Le registre
// compile ayant disparu, la reference est desormais la table
// InstalledBadgeTemplate. A executer en CI apres `prisma db push` et
// `prisma db seed` (cf. Makefile `validate-badge-templates`).
//
// Sortie : 0 = tout OK. 1 = au moins un probleme trouve (orphelin, format ou liaisons).
import { PrismaClient } from "@prisma/client";
import type { VariableDeclaration } from "@tigamadou/pdf-engine";
import { validateBindings, type Bindings } from "../src/lib/badge-templates/bindings";

const prisma = new PrismaClient();

type Orphan = {
  model: "Event" | "Organization" | "PlatformSettings";
  id: string;
  badgeTemplateId: string;
};

async function main(): Promise<void> {
  const installed = await prisma.installedBadgeTemplate.findMany({
    select: { id: true, family: true, version: true, formatVersion: true, layout: true, bindings: true },
  });
  const validIds = new Set(installed.map((t) => t.id));
  const orphans: Orphan[] = [];

  const events = await prisma.event.findMany({
    where: { badgeTemplateId: { not: null } },
    select: { id: true, badgeTemplateId: true },
  });
  for (const e of events) {
    if (e.badgeTemplateId && !validIds.has(e.badgeTemplateId)) {
      orphans.push({ model: "Event", id: e.id, badgeTemplateId: e.badgeTemplateId });
    }
  }

  const orgs = await prisma.organization.findMany({
    where: { badgeTemplateId: { not: null } },
    select: { id: true, badgeTemplateId: true },
  });
  for (const o of orgs) {
    if (o.badgeTemplateId && !validIds.has(o.badgeTemplateId)) {
      orphans.push({ model: "Organization", id: o.id, badgeTemplateId: o.badgeTemplateId });
    }
  }

  const platform = await prisma.platformSettings.findMany({
    select: { id: true, badgeTemplateId: true },
  });
  for (const p of platform) {
    // La chaine vide signifie « aucune racine definie » : resolveTemplate retombe
    // alors sur la famille `default`. Ce n'est pas un orphelin.
    if (p.badgeTemplateId !== "" && !validIds.has(p.badgeTemplateId)) {
      orphans.push({ model: "PlatformSettings", id: p.id, badgeTemplateId: p.badgeTemplateId });
    }
  }

  const hasDefaultFamily = installed.some((t) => t.family === "default");
  if (!hasDefaultFamily) {
    console.error(
      "KO : aucune famille `default` installee. Le repli de resolveTemplate est inoperant -- lancer `make db-seed`.",
    );
    process.exit(1);
  }

  // Deuxieme garde du meme script : une ligne restee en v1 n'est plus rendable par
  // le moteur v2, et une ligne dont les liaisons ne couvrent pas toutes les
  // variables imprimerait des champs vides sans que personne l'ait voulu.
  const bindingIssues: string[] = [];
  for (const t of installed) {
    if (t.formatVersion !== 2) {
      bindingIssues.push(`${t.family} v${t.version} : encore au format v${t.formatVersion} (make migrate-installed-templates).`);
      continue;
    }
    // Une ligne v2 sans tableau `variables` est un layout corrompu : on le signale
    // comme les autres anomalies au lieu de laisser validateBindings planter dessus.
    const variables = (t.layout as { variables?: unknown } | null)?.variables;
    if (!Array.isArray(variables)) {
      bindingIssues.push(`${t.family} v${t.version} : layout v2 sans tableau "variables" (paquet a reinstaller).`);
      continue;
    }
    const errors = validateBindings(variables as VariableDeclaration[], (t.bindings ?? {}) as Bindings);
    if (errors.length > 0) bindingIssues.push(`${t.family} v${t.version} : ${errors.join(" | ")}`);
  }

  if (orphans.length === 0 && bindingIssues.length === 0) {
    console.log(
      `OK : ${events.length} event(s), ${orgs.length} org(s), ${platform.length} platform settings -- tous les badgeTemplateId designent un template installe (${installed.length} au catalogue).`,
    );
    process.exit(0);
  }

  if (bindingIssues.length > 0) {
    console.error(`KO : ${bindingIssues.length} template(s) aux liaisons incompletes :`);
    for (const issue of bindingIssues) console.error(`  - ${issue}`);
  }
  if (orphans.length === 0) process.exit(1);

  console.error(`KO : ${orphans.length} badgeTemplateId orphelin(s) detecte(s) :`);
  for (const o of orphans) {
    console.error(`  - ${o.model}#${o.id} -> "${o.badgeTemplateId}" (inconnu)`);
  }
  console.error(
    "Corrigez la BDD (`make migrate-badge-template-refs`) ou installez le template manquant avant de redeployer.",
  );
  process.exit(1);
}

main()
  .catch((err) => {
    console.error("[validate-badge-templates] erreur inattendue :", err);
    process.exit(2);
  })
  .finally(() => prisma.$disconnect());
