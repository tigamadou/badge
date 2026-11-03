import { Prisma, type PrintSheetGeneration } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { chunk } from "@/lib/badge-batch";
import { appendThreadEvent } from "@/lib/print-requests/thread";
import { logActivity } from "@/lib/activity-log";
import { resolveEventTemplate } from "@/lib/badge-templates/render-badge";
import { BadgeTooLargeError, computeSheetLayout, type LayoutSpec } from "./compute-layout";
import { toLayoutSpec } from "./layout-input";
import { pxToMm } from "./units";

export type GenerationErrorCode =
  | "LAYOUT_NOT_FOUND"
  | "EVENT_NOT_FOUND"
  | "EMPTY_SELECTION"
  | "INVALID_SELECTION"
  | "DUPLEX_UNAVAILABLE"
  | "BADGE_TOO_LARGE"
  | "PRINT_REQUEST_NOT_FOUND"
  | "PRINT_REQUEST_NOT_ADVANCE"
  | "PRINT_REQUEST_NOT_PAID"
  | "GENERATION_IN_PROGRESS";

const HTTP_STATUS: Record<GenerationErrorCode, number> = {
  LAYOUT_NOT_FOUND: 404,
  EVENT_NOT_FOUND: 404,
  EMPTY_SELECTION: 400,
  INVALID_SELECTION: 400,
  DUPLEX_UNAVAILABLE: 400,
  BADGE_TOO_LARGE: 400,
  PRINT_REQUEST_NOT_FOUND: 404,
  PRINT_REQUEST_NOT_ADVANCE: 400,
  PRINT_REQUEST_NOT_PAID: 409,
  GENERATION_IN_PROGRESS: 409,
};

export class GenerationError extends Error {
  readonly httpStatus: number;
  constructor(
    readonly code: GenerationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GenerationError";
    this.httpStatus = HTTP_STATUS[code];
  }
}

// Tous les badges de la commande, lus côté serveur (sans plafond d'identifiants).
export type RequestSelection = { mode: "REQUEST" };

export type GenerationSelection =
  | { mode: "ALL" }
  | { mode: "CATEGORIES"; categoryIds: string[] }
  | { mode: "IDS"; registrationIds: string[] };

// Fige a la creation ; le worker verifie chaque PDF rendu contre badgeMm.
export type GenerationSnapshot = {
  spec: LayoutSpec;
  badgeMm: { width: number; height: number };
  badgePages: 1 | 2;
};

const collator = new Intl.Collator("fr", { sensitivity: "base" });

// Ordre d'impression : categorie, nom, prenom (accents neutres), puis id.
export function orderRegistrations<
  T extends {
    category: { number: number };
    snapshotLastName: string;
    snapshotFirstName: string;
    id: string;
  },
>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      a.category.number - b.category.number ||
      collator.compare(a.snapshotLastName, b.snapshotLastName) ||
      collator.compare(a.snapshotFirstName, b.snapshotFirstName) ||
      (a.id < b.id ? -1 : 1), // ids uniques : jamais egaux
  );
}

// Taille des lectures par identifiants (borne le nombre de parametres SQL d'une requete).
const READ_CHUNK = 5000;

async function selectRegistrations(eventId: string, selection: GenerationSelection) {
  // Colonnes minimales : des milliers de lignes, sans photo ni pieces d'identite.
  const select = {
    id: true,
    eventId: true,
    status: true,
    snapshotLastName: true,
    snapshotFirstName: true,
    category: { select: { number: true } },
  } as const;
  if (selection.mode === "IDS") {
    const ids = [...new Set(selection.registrationIds)];
    if (ids.length === 0) throw new GenerationError("EMPTY_SELECTION", "Aucune inscription sélectionnée");
    // Lecture par paquets : une selection de plusieurs milliers d'ids ne tient pas dans une requete.
    const rows = (
      await Promise.all(
        chunk(ids, READ_CHUNK).map((part) => prisma.registration.findMany({ where: { id: { in: part } }, select })),
      )
    ).flat();
    if (rows.length !== ids.length || rows.some((r) => r.eventId !== eventId || r.status !== "APPROVED")) {
      throw new GenerationError(
        "INVALID_SELECTION",
        "La sélection contient une inscription inconnue, non approuvée ou d'un autre évènement",
      );
    }
    return rows;
  }
  return prisma.registration.findMany({
    where: {
      eventId,
      status: "APPROVED",
      ...(selection.mode === "CATEGORIES" ? { categoryId: { in: selection.categoryIds } } : {}),
    },
    select,
  });
}

// Statuts d'une commande qui autorisent la generation (pas de reimpression apres COMPLETED).
const GENERATION_REQUEST_STATUSES = ["PAID", "IN_PRODUCTION", "READY"];

// Selection d'une generation liee a une commande : contrôles de la commande, puis lecture des
// inscriptions SANS filtre de statut (une inscription passee non APPROVED apres le paiement
// est ecartee au rendu par le worker) ; ordre = position des items.
async function selectRequestRegistrations(
  printRequestId: string,
  eventId: string,
  selection: GenerationSelection | RequestSelection,
) {
  const request = await prisma.printRequest.findUnique({
    where: { id: printRequestId },
    select: { id: true, type: true, status: true, eventId: true },
  });
  if (!request) throw new GenerationError("PRINT_REQUEST_NOT_FOUND", "Commande d'impression introuvable");
  if (request.type !== "ADVANCE") {
    throw new GenerationError("PRINT_REQUEST_NOT_ADVANCE", "Seule une commande à l'avance donne lieu à des planches");
  }
  if (request.eventId !== eventId) {
    throw new GenerationError("INVALID_SELECTION", "La commande concerne un autre évènement");
  }
  if (!GENERATION_REQUEST_STATUSES.includes(request.status)) {
    throw new GenerationError("PRINT_REQUEST_NOT_PAID", "La commande doit être payée pour générer les planches");
  }
  if (selection.mode !== "IDS" && selection.mode !== "REQUEST") {
    throw new GenerationError("INVALID_SELECTION", "Une génération liée à une commande exige une sélection d'inscriptions");
  }
  const wanted = selection.mode === "IDS" ? new Set(selection.registrationIds) : null;
  if (wanted && wanted.size === 0) {
    throw new GenerationError("EMPTY_SELECTION", "Aucun badge à imprimer dans cette commande.");
  }
  const items = await prisma.printRequestItem.findMany({
    where: { requestId: request.id },
    orderBy: { position: "asc" },
    select: { registrationId: true },
  });
  const inRequest = new Set(items.map((i) => i.registrationId));
  if (wanted && [...wanted].some((id) => !inRequest.has(id))) {
    throw new GenerationError("INVALID_SELECTION", "La sélection contient une inscription absente de la commande");
  }
  return items.filter((i) => !wanted || wanted.has(i.registrationId)).map((i) => ({ id: i.registrationId }));
}

// Crée la planche de la commande ou écrase l'existante (remise à PENDING). Le fichier précédent
// reste référencé par `fileKey` : le worker le remplace à la fin d'une génération réussie.
async function saveOrderGeneration(
  tx: Prisma.TransactionClient,
  printRequestId: string,
  data: Prisma.PrintSheetGenerationUncheckedCreateInput,
): Promise<{ generation: PrintSheetGeneration; regenerated: boolean }> {
  const inProgress = () => new GenerationError("GENERATION_IN_PROGRESS", "Une génération est déjà en cours pour cette commande");
  const existing = await tx.printSheetGeneration.findUnique({ where: { printRequestId } });
  if (!existing) {
    try {
      return { generation: await tx.printSheetGeneration.create({ data: { ...data, printRequestId } }), regenerated: false };
    } catch (err) {
      // Création concurrente de la planche de la même commande.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw inProgress();
      throw err;
    }
  }
  // Conditionné à l'état : un worker ou un autre clic ne peut pas être écrasé en cours de route.
  const { count } = await tx.printSheetGeneration.updateMany({
    where: { id: existing.id, status: { in: ["DONE", "FAILED"] } },
    data: {
      ...data,
      status: "PENDING",
      attempts: 0,
      lockedBy: null,
      heartbeatAt: null,
      sheetCount: null,
      skippedIds: Prisma.DbNull,
      error: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
    },
  });
  if (count === 0) throw inProgress();
  return { generation: await tx.printSheetGeneration.findUniqueOrThrow({ where: { id: existing.id } }), regenerated: true };
}

export async function createGeneration(input: {
  eventId: string;
  layoutId: string;
  selection: GenerationSelection | RequestSelection;
  duplex: boolean;
  userId: string;
  printRequestId?: string;
}): Promise<PrintSheetGeneration> {
  const layout = await prisma.printSheetLayout.findUnique({ where: { id: input.layoutId } });
  // Un gabarit archivé n'est plus proposable : traité comme introuvable.
  if (!layout || layout.archived) throw new GenerationError("LAYOUT_NOT_FOUND", "Gabarit introuvable");
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: { id: true, badgeTemplateId: true, orgId: true },
  });
  if (!event) throw new GenerationError("EVENT_NOT_FOUND", "Évènement introuvable");

  const { selection } = input;
  if (selection.mode === "REQUEST" && !input.printRequestId) {
    throw new GenerationError("INVALID_SELECTION", "La sélection « commande » exige une commande d'impression");
  }
  const rows = input.printRequestId
    ? await selectRequestRegistrations(input.printRequestId, event.id, selection)
    : orderRegistrations(await selectRegistrations(event.id, selection as GenerationSelection));
  if (rows.length === 0) {
    throw new GenerationError(
      "EMPTY_SELECTION",
      input.printRequestId ? "Aucun badge à imprimer dans cette commande." : "Aucune inscription approuvée à imprimer",
    );
  }

  const template = await resolveEventTemplate(event);
  const badgePages = template.meta.pages === 2 ? 2 : 1;
  // Commande liee : le recto-verso est impose par le template, la valeur recue est ignoree.
  const duplex = input.printRequestId ? badgePages === 2 : input.duplex;
  if (duplex && badgePages === 1) {
    throw new GenerationError("DUPLEX_UNAVAILABLE", "Le template du badge n'a qu'une page");
  }
  const badgeMm = {
    width: pxToMm(parseFloat(template.meta.pageSize.width)),
    height: pxToMm(parseFloat(template.meta.pageSize.height)),
  };
  const spec = toLayoutSpec(layout);
  try {
    computeSheetLayout(spec, { widthMm: badgeMm.width, heightMm: badgeMm.height });
  } catch (err) {
    if (err instanceof BadgeTooLargeError) {
      throw new GenerationError("BADGE_TOO_LARGE", "Le badge ne tient pas sur la planche");
    }
    throw err;
  }
  const snapshot: GenerationSnapshot = { spec, badgeMm, badgePages };

  const data = {
    output: "SHEETS" as const,
    eventId: event.id,
    layoutId: layout.id,
    layoutSnapshot: snapshot,
    duplex,
    registrationIds: rows.map((r) => r.id),
    badgeCount: rows.length,
    createdById: input.userId,
  };
  const { printRequestId } = input;
  let regenerated = false;
  const generation = printRequestId
    ? await prisma.$transaction(async (tx) => {
        // Une seule planche par commande : une génération existante est écrasée (même ligne).
        const saved = await saveOrderGeneration(tx, printRequestId, data);
        regenerated = saved.regenerated;
        await appendThreadEvent(
          tx,
          printRequestId,
          "SHEETS_GENERATED",
          { generationId: saved.generation.id, badgeCount: rows.length },
          { userId: input.userId, side: "STAFF" },
        );
        return saved.generation;
      })
    : await prisma.printSheetGeneration.create({ data });
  await logActivity({
    type: "PRINT_SHEETS_GENERATED",
    userId: input.userId,
    targetId: generation.id,
    details: {
      eventId: event.id,
      badgeCount: rows.length,
      layoutId: layout.id,
      ...(printRequestId ? { regenerated } : {}),
    },
  });
  return generation;
}

// Export ZIP de l'organisateur : un PDF par badge, dans l'ordre de la sélection, sans plafond.
// Pas de gabarit ni d'instantané de planche (layoutSnapshot reste null).
// Un export identique (même évènement, même utilisateur, même liste ordonnée) encore PENDING ou
// RUNNING est renvoyé tel quel (`reused`) au lieu d'être dupliqué : double clic, rechargement.
export async function createZipExport(input: {
  eventId: string;
  registrationIds: string[];
  userId: string;
}): Promise<{ generation: PrintSheetGeneration; reused: boolean }> {
  const ids = [...new Set(input.registrationIds)];
  if (ids.length > 0) {
    const inProgress = await prisma.printSheetGeneration.findMany({
      where: {
        eventId: input.eventId,
        output: "ZIP",
        createdById: input.userId,
        status: { in: ["PENDING", "RUNNING"] },
        badgeCount: ids.length,
      },
      orderBy: { createdAt: "asc" },
    });
    // badgeCount egal : les deux listes ont la meme longueur, il reste a comparer l'ordre.
    const same = inProgress.find((g) => (g.registrationIds as string[]).every((id, i) => id === ids[i]));
    if (same) return { generation: same, reused: true };
  }
  const rows = await selectRegistrations(input.eventId, { mode: "IDS", registrationIds: ids });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)!);
  const generation = await prisma.printSheetGeneration.create({
    data: {
      output: "ZIP",
      eventId: input.eventId,
      registrationIds: ordered.map((r) => r.id),
      badgeCount: ordered.length,
      createdById: input.userId,
    },
  });
  return { generation, reused: false };
}
