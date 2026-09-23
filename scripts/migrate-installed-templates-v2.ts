import { PrismaClient } from "@prisma/client";
import { listPrefix } from "../src/lib/storage";
import { migrateManifest, V1_VARIABLES } from "../src/lib/badge-templates/migrate-v1";
import { parseManifest } from "../src/lib/badge-templates/engine/declarative/schema";
import { validateBindings, type Bindings } from "../src/lib/badge-templates/bindings";

const prisma = new PrismaClient();

export type MigrationReport = {
  migrated: string[];
  skipped: Array<{ id: string; reason: string }>;
};

// La table de liaison d'un template migre est l'IDENTITE : les variables produites
// par migrateManifest portent exactement le nom des sources v1. Aucun choix humain
// n'est requis, c'est ce qui rend la migration automatisable de bout en bout.
const IDENTITY: Bindings = Object.fromEntries(
  V1_VARIABLES.map((variable) => [variable.name, variable.name]),
);

export async function migrateInstalledTemplates(options: {
  apply: boolean;
}): Promise<MigrationReport> {
  const report: MigrationReport = { migrated: [], skipped: [] };
  const rows = await prisma.installedBadgeTemplate.findMany({ where: { formatVersion: 1 } });

  for (const row of rows) {
    // migrateManifest n'attache un sample d'image que si la ressource existe :
    // il lui faut donc la liste reelle des fichiers du paquet.
    // listPrefix rend des { key, size } aux cles completes ; le manifeste parle
    // en chemins relatifs au paquet (« assets/photo-demo.png »).
    const entries = (await listPrefix(row.assetPrefix)).map(({ key }) =>
      key.slice(row.assetPrefix.length),
    );

    let layout: unknown;
    try {
      layout = migrateManifest(row.layout, entries).manifest;
    } catch (err) {
      report.skipped.push({ id: row.id, reason: `migration : ${(err as Error).message}` });
      continue;
    }

    const parsed = parseManifest(layout, entries);
    if (!parsed.ok) {
      report.skipped.push({ id: row.id, reason: `validation : ${parsed.errors.join(" | ")}` });
      continue;
    }

    const errors = validateBindings(parsed.manifest.variables, IDENTITY);
    if (errors.length > 0) {
      report.skipped.push({ id: row.id, reason: `liaisons : ${errors.join(" | ")}` });
      continue;
    }

    if (options.apply) {
      await prisma.installedBadgeTemplate.update({
        where: { id: row.id },
        data: {
          layout: parsed.manifest as unknown as object,
          bindings: IDENTITY as unknown as object,
          formatVersion: 2,
        },
      });
    }
    report.migrated.push(row.id);
  }

  return report;
}

/* v8 ignore start -- point d'entree CLI, exerce par `make migrate-installed-templates` */
async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const report = await migrateInstalledTemplates({ apply });
  console.log(apply ? "MIGRATION APPLIQUEE" : "DRY-RUN (ajouter --apply pour ecrire)");
  console.log(`migres : ${report.migrated.length}`);
  for (const skipped of report.skipped) console.error(`SAUTE ${skipped.id} : ${skipped.reason}`);
  // process.exitCode (pas process.exit) : un exit force couperait le process avant
  // que le .finally ci-dessous n'ait pu deconnecter prisma, comme dans
  // migrate-badge-template-refs.ts. Node quitte de lui-meme une fois la boucle
  // d'evenements videe, avec ce code de sortie.
  process.exitCode = report.skipped.length > 0 ? 1 : 0;
}

if (process.argv[1]?.endsWith("migrate-installed-templates-v2.ts")) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
/* v8 ignore stop */
