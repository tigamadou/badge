import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { deletePrefix } from "@/lib/storage";
import { DEMO_PASSWORD, DEV_SUPER_ADMIN_EMAIL } from "../../../constants";
import { createDemoContext, type DemoContext } from "../../context";
import { seedAccounts } from "../../accounts";
import { seedOrganizationsAndEvents } from "../../organizations";
import { seedRegistrations } from "../../registrations";
import { loadWorld, type DemoWorld } from "../world";

export const TEST_PREFIX = "demo/_test/";

export async function cleanTemplates(): Promise<void> {
  const rows = await prisma.installedBadgeTemplate.findMany({
    where: { family: { startsWith: "demo-" } },
    select: { id: true, assetPrefix: true },
  });
  await prisma.installedBadgeTemplate.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  for (const r of rows) await deletePrefix(r.assetPrefix);
}

/** Exécute les modules du socle (comptes, organisations, inscriptions) sur la base de test, sans facturation. */
export async function buildWorld(scale = 0.05): Promise<{ ctx: DemoContext; world: DemoWorld }> {
  await cleanTemplates();
  await prisma.user.create({
    data: {
      email: DEV_SUPER_ADMIN_EMAIL,
      password: await hash(DEMO_PASSWORD, 4),
      name: "Super Admin",
      isStaff: true,
      staffRole: "SUPER_ADMIN",
      emailVerifiedAt: new Date(),
    },
  });
  await prisma.rejectionReason.createMany({
    data: [
      { label: "Photo illisible", scope: "PROFILE", sortOrder: 10 },
      { label: "Document suspect", scope: "BOTH", sortOrder: 20 },
      { label: "Quota atteint", scope: "REGISTRATION", sortOrder: 30 },
      { label: "Inscription en doublon", scope: "REGISTRATION", sortOrder: 40 },
    ],
  });
  const ctx = await createDemoContext({ env: { BADGE_ENV: "dev" }, scale, storagePrefix: TEST_PREFIX });
  await seedAccounts(ctx);
  await seedOrganizationsAndEvents(ctx);
  await seedRegistrations(ctx);
  return { ctx, world: await loadWorld() };
}

export async function teardownWorld(ctx: DemoContext | undefined): Promise<void> {
  await cleanTemplates();
  await ctx?.storage.clearTracked();
}
