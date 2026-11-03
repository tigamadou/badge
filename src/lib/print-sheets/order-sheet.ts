import type { PrintSheetGenerationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type OrderSheetView = {
  generationId: string;
  status: PrintSheetGenerationStatus;
  layoutName: string | null;
  duplex: boolean;
  badgeCount: number | null;
  sheetCount: number | null;
  pageCount: number | null;
  completedAt: string | null;
  error: string | null;
  downloadUrl: string | null;
};

// Planche unique d'une commande (une génération par commande), ou null si aucune.
export async function getOrderSheet(requestId: string): Promise<OrderSheetView | null> {
  const gen = await prisma.printSheetGeneration.findUnique({
    where: { printRequestId: requestId },
    include: { layout: { select: { name: true } } },
  });
  if (!gen) return null;
  return {
    generationId: gen.id,
    status: gen.status,
    layoutName: gen.layout?.name ?? null,
    duplex: gen.duplex,
    badgeCount: gen.badgeCount,
    sheetCount: gen.sheetCount,
    pageCount: gen.sheetCount === null ? null : gen.sheetCount * (gen.duplex ? 2 : 1),
    completedAt: gen.completedAt?.toISOString() ?? null,
    error: gen.error,
    downloadUrl: gen.status === "DONE" ? `/api/files/${gen.fileKey ?? `print-sheets/${gen.id}.pdf`}` : null,
  };
}
