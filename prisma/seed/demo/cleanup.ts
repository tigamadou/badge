import { prisma } from "../../../src/lib/prisma";
import { deletePrefix } from "../../../src/lib/storage";
import { DEMO_BADGE_LOCAL_EMAILS, DEMO_DOMAIN, DEMO_SLUG_PREFIX } from "../constants";
import type { DemoContext } from "./context";

/**
 * Supprime ce que le socle et les lots 1 ont créé : journal d'activité, organisations `demo-`
 * (cascade évènements, inscriptions, membres), modèles de badge `demo-`, utilisateurs de démo,
 * puis le stockage (clés suivies + préfixe). Les motifs, plans et `admin@badge.local` restent.
 */
export async function cleanupDemoCore(ctx: DemoContext): Promise<void> {
  const orgs = await prisma.organization.findMany({
    where: { slug: { startsWith: DEMO_SLUG_PREFIX } },
    select: { id: true },
  });
  const orgIds = orgs.map((o) => o.id);
  const events = await prisma.event.findMany({ where: { orgId: { in: orgIds } }, select: { id: true } });
  const eventIds = events.map((e) => e.id);
  const users = await prisma.user.findMany({
    where: { OR: [{ email: { endsWith: DEMO_DOMAIN } }, { email: { in: [...DEMO_BADGE_LOCAL_EMAILS] } }] },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  await prisma.activityLog.deleteMany({
    where: { OR: [{ orgId: { in: orgIds } }, { eventId: { in: eventIds } }, { userId: { in: userIds } }] },
  });
  // Registration -> Category est RESTRICT : les inscriptions partent avant la cascade org -> evenement -> categorie.
  await prisma.registration.deleteMany({ where: { eventId: { in: eventIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });

  const templates = await prisma.installedBadgeTemplate.findMany({
    where: { family: { startsWith: DEMO_SLUG_PREFIX } },
    select: { id: true, assetPrefix: true },
  });
  await prisma.installedBadgeTemplate.deleteMany({ where: { id: { in: templates.map((t) => t.id) } } });
  for (const t of templates) {
    if (t.assetPrefix.startsWith("badge-templates/")) await deletePrefix(t.assetPrefix);
  }

  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await ctx.storage.clearTracked();
}
