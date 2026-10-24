import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { NotificationLink } from "./types";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// La spec 25 régénère l'ID d'une inscription au changement de catégorie : les liens des
// notifications existantes (quel que soit le destinataire) suivent le nouvel ID.
// Remplacement par segment exact : un ID qui contient l'ancien en sous-chaîne est ignoré.
export async function rewriteNotificationLinks(
  oldRegistrationId: string,
  newRegistrationId: string,
  tx?: Prisma.TransactionClient,
): Promise<number> {
  const db = tx ?? prisma;
  const oldId = encodeURIComponent(oldRegistrationId);
  const pattern = new RegExp(`/registrations/${escapeRegExp(oldId)}(?=$|[/?#])`);
  const replacement = `/registrations/${encodeURIComponent(newRegistrationId)}`;
  const rewrite = (href: string) => href.replace(pattern, replacement);

  const candidates = await db.notification.findMany({
    where: { href: { contains: oldId } },
    select: { id: true, href: true, links: true },
  });
  let updated = 0;
  for (const n of candidates) {
    // Le lien principal est toujours en links[0] : une référence dans links implique href.
    const href = rewrite(n.href as string);
    if (href === n.href) continue;
    const links = Array.isArray(n.links)
      ? (n.links as NotificationLink[]).map((l) => ({ ...l, href: rewrite(l.href) }))
      : n.links;
    await db.notification.update({
      where: { id: n.id },
      data: { href, links: links as Prisma.InputJsonValue },
    });
    updated += 1;
  }
  return updated;
}
