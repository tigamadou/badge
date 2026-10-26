import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { prisma } from "@/lib/prisma";
import { getFile } from "@/lib/storage";
import { assetNamesFor } from "./engine-upgrade";
import { readLayout } from "./resolve";

// Exporte les templates installes vers un dossier a deposer dans le corpus de
// non-regression de pdfStudio (packages/engine/corpus/) : c'est ce qui protege les
// vrais templates de production lors d'une nouvelle version du moteur. Ce sont des
// templates, jamais des donnees de participants.
export async function exportEngineCorpus(outDir: string): Promise<string[]> {
  const rows = await prisma.installedBadgeTemplate.findMany({
    orderBy: [{ family: "asc" }, { version: "asc" }],
  });
  const dirs: string[] = [];
  for (const row of rows) {
    // Un layout v1 casserait le corpus de pdfStudio (qui ne lit que le format v3) ;
    // un layout v2 est migre en memoire.
    if (row.formatVersion !== 2 && row.formatVersion !== 3) continue;
    const manifest = readLayout(row);
    const dir = join(outDir, `${row.family}-v${row.version}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    for (const name of assetNamesFor(manifest)) {
      let body: Buffer;
      try {
        body = (await getFile(`${row.assetPrefix}${name}`)).body;
      } catch {
        throw new Error(
          `export du corpus : ressource "${name}" de ${row.family} v${row.version} absente du stockage.`,
        );
      }
      mkdirSync(dirname(join(dir, name)), { recursive: true });
      writeFileSync(join(dir, name), body);
    }
    dirs.push(dir);
  }
  return dirs;
}
