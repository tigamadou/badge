// Point d'entree du seed. SEED_MODE :
//   minimal (defaut) -> donnees de reference + SUPER_ADMIN
//   demo             -> minimal puis seed de demonstration (dev / preprod uniquement)
//   super-admin      -> SUPER_ADMIN seul (service compose `init`, prod et preprod)
import { prisma } from "../src/lib/prisma";
import { seedSuperAdmin } from "../src/lib/seed-super-admin";
import { runMinimalSeed } from "./seed/minimal";
import { runDemoSeed } from "./seed/demo";

async function main() {
  const mode = process.env.SEED_MODE ?? "minimal";

  if (mode === "super-admin") {
    const result = await seedSuperAdmin();
    if (result.status === "created") console.log(`SUPER_ADMIN cree : ${result.email}`);
    else if (result.status === "exists") console.log("SUPER_ADMIN deja present, rien a faire");
    else console.warn(`Seed SUPER_ADMIN ignore : ${result.reason}`);
    return;
  }

  if (mode === "minimal") {
    await runMinimalSeed();
    console.log("Seed minimal termine. Pour le seed de demonstration : SEED_MODE=demo");
    return;
  }

  if (mode === "demo") {
    await runMinimalSeed();
    await runDemoSeed();
    return;
  }

  throw new Error(`SEED_MODE inconnu : ${mode} (minimal | demo | super-admin)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
