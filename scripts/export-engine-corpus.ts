import { prisma } from "../src/lib/prisma";
import { exportEngineCorpus } from "../src/lib/badge-templates/engine-corpus";

// Usage : yarn tsx scripts/export-engine-corpus.ts [dossier]  (defaut : backups/engine-corpus)
async function main(): Promise<void> {
  const out = process.argv[2] ?? "backups/engine-corpus";
  const dirs = await exportEngineCorpus(out);
  console.log(`${dirs.length} template(s) exporte(s) vers ${out} :`);
  for (const dir of dirs) console.log(`  - ${dir}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
