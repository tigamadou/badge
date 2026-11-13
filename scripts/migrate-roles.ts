import { PrismaClient } from "@prisma/client";
import { migrateRoles } from "../src/lib/permissions/migrate";

// Usage : yarn tsx scripts/migrate-roles.ts [--dry-run]
// Idempotent : ne cible que les lignes sans roleId, ne touche jamais aux colonnes d'enum.
async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const db = new PrismaClient();
  try {
    const report = await migrateRoles(db, { dryRun });
    console.log(dryRun ? "Simulation (aucune écriture) :" : "Migration des rôles effectuée :");
    console.log(`  - utilisateurs staff : ${report.users}`);
    console.log(`  - membres d'organisation : ${report.orgMemberships}`);
    console.log(`  - membres d'évènement : ${report.eventMemberships}`);
    console.log(`  - lignes déjà migrées : ${report.alreadyDone}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
