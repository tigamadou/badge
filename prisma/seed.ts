// Point d'entree du seed. SEED_MODE :
//   minimal (defaut) -> donnees de reference + SUPER_ADMIN
//   demo             -> minimal puis seed de demonstration (dev / preprod uniquement)
//   super-admin      -> SUPER_ADMIN seul (service compose `init`, prod et preprod)
import { prisma } from "../src/lib/prisma";
import { runSeed } from "./seed/run";

runSeed(process.env.SEED_MODE ?? "minimal")
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
