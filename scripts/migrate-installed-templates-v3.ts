import { PrismaClient } from "@prisma/client";
import { migrateManifest as migrateToV3, parseManifest } from "@tigamadou/pdf-engine";
import type { PackageAsset } from "@tigamadou/pdf-engine/package";
import { renderProof } from "@tigamadou/pdf-engine/proof";
import { ExportError } from "@tigamadou/pdf-engine/export";
import { getFile, listPrefix, uploadFile } from "../src/lib/storage";
import { getExporter } from "../src/lib/renderer";
import { migrateManifest as migrateV1ToV2, V1_VARIABLES } from "../src/lib/badge-templates/migrate-v1";
import { validateBindings, type Bindings } from "../src/lib/badge-templates/bindings";
import { assetNamesFor } from "../src/lib/badge-templates/engine-upgrade";
import { PROOF_FILE } from "../src/lib/badge-templates/install";

const prisma = new PrismaClient();

export type MigrationV3Report = {
  migrated: Array<{ id: string; from: 1 | 2; proofPath: string }>;
  skipped: Array<{ id: string; reason: string }>;
  applied: boolean;
};

// La table de liaison d'une ligne v1 est l'IDENTITE : les variables produites par la
// migration 1 -> 2 portent exactement le nom des sources v1. Aucun choix humain n'est
// requis, c'est ce qui rend la migration automatisable de bout en bout.
const IDENTITY: Bindings = Object.fromEntries(V1_VARIABLES.map((variable) => [variable.name, variable.name]));

type Prepared = { id: string; from: 1 | 2; layout: object; bindings: Bindings; proofPath: string };

// Lignes formatVersion < 3, archivees comprises. Phase 1, par ligne : 1 -> 2 si besoin,
// 2 -> 3, validation, ressources, epreuve rendue par le service (meme en dry-run : c'est
// ce qui prouve que la ligne s'imprimera). Avec apply, l'epreuve est televersee sous une
// cle nouvelle (proof.pdf reste en place). Phase 2, seulement si apply et aucune ligne
// sautee : UNE transaction ecrit layout, liaisons, format et epreuve de toutes les lignes.
export async function migrateInstalledTemplatesV3(options: { apply: boolean }): Promise<MigrationV3Report> {
  const report: MigrationV3Report = { migrated: [], skipped: [], applied: false };
  const prepared: Prepared[] = [];
  const rows = await prisma.installedBadgeTemplate.findMany({ where: { formatVersion: { lt: 3 } } });

  for (const row of rows) {
    const skip = (reason: string) => report.skipped.push({ id: row.id, reason });
    const from = row.formatVersion as 1 | 2;
    // migrateV1ToV2 n'attache un sample d'image que si la ressource existe : il lui faut
    // la liste reelle des fichiers du paquet (chemins relatifs au paquet).
    const entries = (await listPrefix(row.assetPrefix)).map(({ key }) => key.slice(row.assetPrefix.length));

    let layout: unknown;
    let bindings: Bindings;
    try {
      layout = from === 1 ? migrateV1ToV2(row.layout, entries).manifest : row.layout;
      bindings = from === 1 ? IDENTITY : (row.bindings as Bindings);
      layout = migrateToV3(layout);
    } catch (err) {
      skip(`migration : ${(err as Error).message}`);
      continue;
    }

    const parsed = parseManifest(layout, entries);
    if (!parsed.ok) {
      skip(`validation : ${parsed.errors.join(" | ")}`);
      continue;
    }
    const manifest = parsed.manifest;

    const errors = validateBindings(manifest.variables, bindings);
    if (errors.length > 0) {
      skip(`liaisons : ${errors.join(" | ")}`);
      continue;
    }

    // parseManifest a verifie les ressources contre le contenu du stockage : une lecture
    // qui echoue ici est une panne, rapportee comme un echec de rendu.
    let png: Uint8Array;
    try {
      const assets: PackageAsset[] = await Promise.all(
        assetNamesFor(manifest).map(async (name) => {
          const file = await getFile(`${row.assetPrefix}${name}`);
          return { path: name, body: file.body, contentType: file.contentType };
        }),
      );
      ({ png } = await renderProof(manifest, assets, row.id, getExporter()));
    } catch (err) {
      skip(
        err instanceof ExportError && (err.code === "UNAVAILABLE" || err.code === "TIMEOUT")
          ? `service de rendu indisponible : ${err.message}`
          : `rendu : ${(err as Error).message}`,
      );
      continue;
    }

    const proofPath = `${row.assetPrefix}${PROOF_FILE}`;
    if (options.apply) await uploadFile(proofPath, Buffer.from(png), "image/png");
    prepared.push({ id: row.id, from, layout: manifest as unknown as object, bindings, proofPath });
  }

  if (options.apply && report.skipped.length === 0) {
    await prisma.$transaction(
      prepared.map((p) =>
        prisma.installedBadgeTemplate.update({
          where: { id: p.id },
          data: { layout: p.layout, bindings: p.bindings as unknown as object, formatVersion: 3, proofPath: p.proofPath },
        }),
      ),
    );
    report.applied = true;
  }
  report.migrated = prepared.map(({ id, from, proofPath }) => ({ id, from, proofPath }));
  return report;
}

/* v8 ignore start -- point d'entree CLI, exerce par `make migrate-installed-templates` */
async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const report = await migrateInstalledTemplatesV3({ apply });
  console.log(apply ? (report.applied ? "MIGRATION APPLIQUEE" : "MIGRATION NON APPLIQUEE (lignes sautees)") : "DRY-RUN (ajouter --apply pour ecrire)");
  console.log(`migres : ${report.migrated.length}`);
  for (const skipped of report.skipped) console.error(`SAUTE ${skipped.id} : ${skipped.reason}`);
  // process.exitCode (pas process.exit) : un exit force couperait le process avant
  // que le .finally ci-dessous n'ait pu deconnecter prisma.
  process.exitCode = report.skipped.length > 0 ? 1 : 0;
}

if (process.argv[1]?.endsWith("migrate-installed-templates-v3.ts")) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
/* v8 ignore stop */
