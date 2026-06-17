// v2-12 : valide qu'aucun `badgeTemplateId` persiste en BDD ne reference un id
// orphelin du registry. A executer en CI apres `prisma db push` et avant les
// tests (cf. Makefile `validate-badge-templates`).
//
// Sortie : 0 = tout OK. 1 = au moins un orphelin trouve.
import { PrismaClient } from "@prisma/client";
import { BADGE_TEMPLATES } from "../src/lib/badge-templates";

const prisma = new PrismaClient();

type Orphan = {
  model: "Event" | "Organization" | "PlatformSettings";
  id: string;
  badgeTemplateId: string;
};

async function main(): Promise<void> {
  const validIds = new Set(Object.keys(BADGE_TEMPLATES));
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
      orphans.push({
        model: "Organization",
        id: o.id,
        badgeTemplateId: o.badgeTemplateId,
      });
    }
  }

  const platform = await prisma.platformSettings.findMany({
    select: { id: true, badgeTemplateId: true },
  });
  for (const p of platform) {
    if (!validIds.has(p.badgeTemplateId)) {
      orphans.push({
        model: "PlatformSettings",
        id: p.id,
        badgeTemplateId: p.badgeTemplateId,
      });
    }
  }

  if (orphans.length === 0) {
    console.log(
      `OK : ${events.length} event(s), ${orgs.length} org(s), ${platform.length} platform settings -- tous les badgeTemplateId presents dans le registry [${[...validIds].join(", ")}].`,
    );
    process.exit(0);
  }

  console.error(`KO : ${orphans.length} badgeTemplateId orphelin(s) detecte(s) :`);
  for (const o of orphans) {
    console.error(`  - ${o.model}#${o.id} -> "${o.badgeTemplateId}" (inconnu)`);
  }
  console.error(
    `Templates valides : [${[...validIds].join(", ")}]. Corrigez la BDD ou ajoutez le template au registry avant de redeployer.`,
  );
  process.exit(1);
}

main()
  .catch((err) => {
    console.error("[validate-badge-templates] erreur inattendue :", err);
    process.exit(2);
  })
  .finally(() => prisma.$disconnect());
