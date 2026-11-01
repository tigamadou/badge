// Module pur (client + serveur) : nommage des PDF de badge et lecture du parametre
// `ids` des ecrans d'impression par lot. Aucune dependance Prisma.
import { slugify } from "@/lib/slugify";

// Taille maximale d'un envoi de marquage "imprime" (`registrations/print`).
export const MARK_PRINTED_CHUNK = 500;

// Decoupe en paquets consecutifs d'au plus `size` elements, ordre conserve.
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export type BadgeFileNameInput = {
  id: string;
  snapshotFirstName: string;
  snapshotLastName: string;
  category: { anonymous: boolean };
};

// `<id>-<prenom>-<nom>.pdf` en ASCII minuscule. Categorie anonyme : `<id>.pdf`,
// le nom du fichier ne doit pas reveler l'identite.
export function badgeFileName(reg: BadgeFileNameInput): string {
  const id = reg.id.replace(/[^A-Za-z0-9-]+/g, "-");
  if (reg.category.anonymous) return `${id}.pdf`;
  const parts = [reg.snapshotFirstName, reg.snapshotLastName]
    .map((s) => slugify(s, { maxLength: 40, fallback: "" }))
    .filter(Boolean);
  return `${[id, ...parts].join("-")}.pdf`;
}

// Identifiants separes par des virgules : nettoyes, dedoublonnes, ordre conserve.
export function parseBadgeIds(raw: string | null): string[] {
  return [...new Set((raw ?? "").split(",").map((s) => s.trim()).filter(Boolean))];
}

export const BATCH_RENDER_CONCURRENCY = 4;

// Applique fn avec au plus `limit` appels simultanes ; resultats dans l'ordre d'entree.
// Rejette avec la premiere erreur, sans lancer de nouvel appel apres elle.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const index = next++;
      try {
        results[index] = await fn(items[index]);
      } catch (err) {
        failed = true;
        throw err;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
