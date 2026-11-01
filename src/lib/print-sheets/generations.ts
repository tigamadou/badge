import type { PrintSheetGeneration } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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
  | "BADGE_TOO_LARGE";

const HTTP_STATUS: Record<GenerationErrorCode, number> = {
  LAYOUT_NOT_FOUND: 404,
  EVENT_NOT_FOUND: 404,
  EMPTY_SELECTION: 400,
  INVALID_SELECTION: 400,
  DUPLEX_UNAVAILABLE: 400,
  BADGE_TOO_LARGE: 400,
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
    const rows = await prisma.registration.findMany({ where: { id: { in: ids } }, select });
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

export async function createGeneration(input: {
  eventId: string;
  layoutId: string;
  selection: GenerationSelection;
  duplex: boolean;
  userId: string;
}): Promise<PrintSheetGeneration> {
  const layout = await prisma.printSheetLayout.findUnique({ where: { id: input.layoutId } });
  // Un gabarit archivé n'est plus proposable : traité comme introuvable.
  if (!layout || layout.archived) throw new GenerationError("LAYOUT_NOT_FOUND", "Gabarit introuvable");
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: { id: true, badgeTemplateId: true, orgId: true },
  });
  if (!event) throw new GenerationError("EVENT_NOT_FOUND", "Évènement introuvable");

  const rows = orderRegistrations(await selectRegistrations(event.id, input.selection));
  if (rows.length === 0) throw new GenerationError("EMPTY_SELECTION", "Aucune inscription approuvée à imprimer");

  const template = await resolveEventTemplate(event);
  const badgePages = template.meta.pages === 2 ? 2 : 1;
  if (input.duplex && badgePages === 1) {
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

  const generation = await prisma.printSheetGeneration.create({
    data: {
      output: "SHEETS",
      eventId: event.id,
      layoutId: layout.id,
      layoutSnapshot: snapshot,
      duplex: input.duplex,
      registrationIds: rows.map((r) => r.id),
      badgeCount: rows.length,
      createdById: input.userId,
    },
  });
  await logActivity({
    type: "PRINT_SHEETS_GENERATED",
    userId: input.userId,
    targetId: generation.id,
    details: { eventId: event.id, badgeCount: rows.length, layoutId: layout.id },
  });
  return generation;
}

// Export ZIP de l'organisateur : un PDF par badge, dans l'ordre de la sélection, sans plafond.
// Pas de gabarit ni d'instantané de planche (layoutSnapshot reste null).
export async function createZipExport(input: {
  eventId: string;
  registrationIds: string[];
  userId: string;
}): Promise<PrintSheetGeneration> {
  const ids = [...new Set(input.registrationIds)];
  const rows = await selectRegistrations(input.eventId, { mode: "IDS", registrationIds: ids });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)!);
  return prisma.printSheetGeneration.create({
    data: {
      output: "ZIP",
      eventId: input.eventId,
      registrationIds: ordered.map((r) => r.id),
      badgeCount: ordered.length,
      createdById: input.userId,
    },
  });
}
