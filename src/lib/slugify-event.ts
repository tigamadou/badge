import { prisma } from "@/lib/prisma";

export function slugifyEvent(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
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
