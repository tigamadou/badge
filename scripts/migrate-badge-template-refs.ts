import { PrismaClient } from "@prisma/client";
import { ensureReferenceTemplates } from "../src/lib/badge-templates/install";

const prisma = new PrismaClient();

// Correspondance entre les anciens identifiants du registre compile et les familles
// installees qui les remplacent.
const LEGACY_TO_FAMILY: Record<string, string> = {
  "default-v1": "default",
  "recto-verso-v1": "recto-verso",
};

export type MigrationReport = {
  events: number;
  orgs: number;
  platform: number;
  unknown: string[];
};

// Convertit les references texte du registre compile vers les cuid des templates
// installes. Idempotent : une seconde execution ne trouve plus rien a convertir.
export async function migrateRefs(installedById: string): Promise<MigrationReport> {
  await ensureReferenceTemplates(installedById);

  const report: MigrationReport = { events: 0, orgs: 0, platform: 0, unknown: [] };

  for (const [legacyId, family] of Object.entries(LEGACY_TO_FAMILY)) {
    const target = await prisma.installedBadgeTemplate.findFirst({
      where: { family },
      orderBy: { version: "desc" },
      select: { id: true },
    });
    if (!target) {
      report.unknown.push(`famille "${family}" absente : rien a migrer pour "${legacyId}"`);
      continue;
    }

    const events = await prisma.event.updateMany({
      where: { badgeTemplateId: legacyId },
      data: { badgeTemplateId: target.id },
    });
    const orgs = await prisma.organization.updateMany({
      where: { badgeTemplateId: legacyId },
      data: { badgeTemplateId: target.id },
    });
    const platform = await prisma.platformSettings.updateMany({
      where: { badgeTemplateId: legacyId },
      data: { badgeTemplateId: target.id },
    });

    report.events += events.count;
    report.orgs += orgs.count;
    report.platform += platform.count;
  }

  // Toute valeur restante qui ne designe ni un template installe ni un ancien
  // identifiant connu est signalee : mieux vaut le savoir que le decouvrir en
  // imprimant un badge.
  const installedIds = new Set(
    (await prisma.installedBadgeTemplate.findMany({ select: { id: true } })).map((t) => t.id),
  );
  const dangling = async (label: string, values: (string | null)[]) => {
    for (const value of values) {
      if (value === null) continue;
      if (installedIds.has(value)) continue;
      report.unknown.push(`${label} : "${value}"`);
    }
  };

  await dangling(
    "Event.badgeTemplateId",
    (await prisma.event.findMany({ select: { badgeTemplateId: true } })).map((e) => e.badgeTemplateId),
  );
  await dangling(
    "Organization.badgeTemplateId",
    (await prisma.organization.findMany({ select: { badgeTemplateId: true } })).map(
      (o) => o.badgeTemplateId,
    ),
  );
  await dangling(
    "PlatformSettings.badgeTemplateId",
    (await prisma.platformSettings.findMany({ select: { badgeTemplateId: true } })).map(
      (p) => p.badgeTemplateId,
    ),
  );

  return report;
}

/* v8 ignore start -- point d'entree CLI, exerce par `make migrate-badge-template-refs` */
async function main(): Promise<void> {
  const admin = await prisma.user.findFirst({
    where: { isStaff: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) {
    console.error("Aucun utilisateur staff : lancer `make db-seed` d'abord.");
    process.exitCode = 1;
    return;
  }

  const report = await migrateRefs(admin.id);
  console.log(`Evenements migres      : ${report.events}`);
  console.log(`Organisations migrees  : ${report.orgs}`);
  console.log(`Parametres plateforme  : ${report.platform}`);
  if (report.unknown.length > 0) {
    console.warn("References inconnues (a examiner) :");
    for (const line of report.unknown) console.warn(`  - ${line}`);
  } else {
    console.log("Aucune reference orpheline.");
  }
}

if (process.argv[1]?.endsWith("migrate-badge-template-refs.ts")) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
/* v8 ignore stop */
