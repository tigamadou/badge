// Initialisation prod/preprod : lance par le service compose `init` apres le
// `prisma db push`. Ne cree le SUPER_ADMIN que si la base n'en contient aucun.
import { prisma } from "../src/lib/prisma";
import { seedSuperAdmin } from "../src/lib/seed-super-admin";

seedSuperAdmin()
  .then((result) => {
    if (result.status === "created") console.log(`SUPER_ADMIN cree : ${result.email}`);
    else if (result.status === "exists") console.log("SUPER_ADMIN deja present, rien a faire");
    else console.warn(`Seed SUPER_ADMIN ignore : ${result.reason}`);
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
