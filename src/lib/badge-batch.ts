// Module pur (client + serveur) : nommage des PDF de badge et lecture du parametre
// `ids` des ecrans d'impression par lot. Aucune dependance Prisma.
import { slugify } from "@/lib/slugify";

// Taille maximale d'un lot (route ZIP et page d'impression par lot).
export const MAX_BADGES_PER_BATCH = 200;

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
