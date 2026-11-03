import { prisma } from "@/lib/prisma";
import { GenerationsScreen } from "@/components/staff/print/GenerationsScreen";
import type { GenerationRow } from "@/components/staff/print/GenerationList";
import { loadLayoutOptions, requireSheetsStaff } from "../sheets-data";

export const dynamic = "force-dynamic";

export default async function FreeSheetsPage() {
  await requireSheetsStaff();
  const [layouts, generations] = await Promise.all([
    loadLayoutOptions(),
    prisma.printSheetGeneration.findMany({
      // Historique de la génération libre : les planches de commande ont leur sous-page.
      where: { output: "SHEETS", printRequestId: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        duplex: true,
        badgeCount: true,
        sheetCount: true,
        skippedIds: true,
        error: true,
        createdAt: true,
        event: { select: { id: true, title: true } },
        layout: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
  ]);
  const initial = generations.map((g) => ({ ...g, createdAt: g.createdAt.toISOString() })) as GenerationRow[];
  return <GenerationsScreen layouts={layouts} initial={initial} />;
}
