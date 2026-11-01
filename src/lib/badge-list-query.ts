import type { Prisma } from "@prisma/client";

// Filtres de la liste des badges, partages par `GET …/badges` (page) et
// `GET …/badges/ids` (tout selectionner) : les deux doivent designer exactement les memes lignes.

export const BADGE_FILTERS = ["all", "unprinted", "printed", "allaccess"] as const;
export type BadgeFilter = (typeof BADGE_FILTERS)[number];

export const BADGE_PAGE_SIZE_DEFAULT = 100;
export const BADGE_PAGE_SIZE_MAX = 500;

// Tri stable (l'id departage les homonymes) : indispensable pour paginer sans doublon ni trou.
export const BADGE_LIST_ORDER: Prisma.RegistrationOrderByWithRelationInput[] = [
  { snapshotLastName: "asc" },
  { snapshotFirstName: "asc" },
  { id: "asc" },
];

function positiveInt(raw: string | null, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function parseBadgePage(params: URLSearchParams): { page: number; pageSize: number } {
  return {
    page: positiveInt(params.get("page"), 1),
    pageSize: Math.min(positiveInt(params.get("pageSize"), BADGE_PAGE_SIZE_DEFAULT), BADGE_PAGE_SIZE_MAX),
  };
}

// Inscriptions APPROVED de l'evenement correspondant aux filtres. `eventId` vient toujours de la
// garde (jamais de la requete) ; une categorie d'un autre evenement ne renvoie donc rien.
export function buildBadgeWhere(eventId: string, params: URLSearchParams): Prisma.RegistrationWhereInput {
  const filter = params.get("filter");
  const categoryId = params.get("categoryId");
  const tokens = (params.get("q") ?? "").trim().split(/\s+/).filter(Boolean);

  return {
    eventId,
    status: "APPROVED",
    ...(filter === "printed" ? { badgePrinted: true } : {}),
    ...(filter === "unprinted" ? { badgePrinted: false } : {}),
    ...(filter === "allaccess" ? { allAccessGranted: true } : {}),
    ...(categoryId ? { categoryId } : {}),
    // Chaque mot doit apparaitre dans le prenom, le nom ou l'identifiant.
    ...(tokens.length
      ? {
          AND: tokens.map((t) => ({
            OR: [
              { snapshotFirstName: { contains: t } },
              { snapshotLastName: { contains: t } },
              { id: { contains: t } },
            ],
          })),
        }
      : {}),
  };
}
