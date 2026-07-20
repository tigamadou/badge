// Slugify isomorphe (client + serveur), sans dependance Prisma : importable
// depuis un Client Component pour une preview live du slug.
// L'unicite (suffixe -2, -3...) est geree separement cote serveur.
export function slugify(
  input: string,
  opts: { maxLength?: number; fallback?: string } = {},
): string {
  const { maxLength = 60, fallback = "org" } = opts;
  const base = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return base || fallback;
}
