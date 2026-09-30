import { prisma } from "../src/lib/prisma";
import { formatReport, verifyEngineUpgrade } from "../src/lib/badge-templates/engine-upgrade";

// Usage : yarn tsx scripts/verify-engine-upgrade.ts [--accept]
// Sans --accept, rien n'est ecrit hors des epreuves regenerees. Code 1 si un
// template est refuse : ne pas deployer.
async function main(): Promise<number> {
  const report = await verifyEngineUpgrade({ accept: process.argv.includes("--accept") });
  console.log(formatReport(report));
  return report.refused.length > 0 ? 1 : 0;
}

main()
  .then(async (code) => {
    await prisma.$disconnect();
    process.exit(code);
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
