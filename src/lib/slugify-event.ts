import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

// Delegue au helper partage. Longueur large et fallback "event" : le slug
// d'evenement n'etait historiquement ni tronque a 60 ni replie sur "org".
export function slugifyEvent(input: string): string {
  return slugify(input, { maxLength: 200, fallback: "event" });
}

export async function uniqueEventSlug(title: string): Promise<string> {
  const base = slugifyEvent(title) || "event";
  let candidate = base;
  let i = 2;
  // Le caller traite la rare race TOCTOU via try/catch sur P2002.
  while (i <= 1000) {
    const exists = await prisma.event.findUnique({ where: { slug: candidate } });
    if (!exists) return candidate;
    candidate = `${base}-${i}`;
    i++;
  }
  throw new Error("Slug allocation exhausted");
}
