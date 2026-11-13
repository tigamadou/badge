import { requirePlatformPage } from "@/app/platform/page-guard";
import { prisma } from "@/lib/prisma";

// Accès aux planches : `print.sheets.read`. `canGenerate` (`print.sheets.generate`) commande les boutons de génération.
export async function requireSheetsStaff(): Promise<{ canGenerate: boolean }> {
  const { permissions } = await requirePlatformPage("print.sheets.read", "/platform/print/sheets");
  return { canGenerate: permissions.has("print.sheets.generate") };
}

// Gabarits proposables (non archivés).
export function loadLayoutOptions() {
  return prisma.printSheetLayout.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sheetWidth: true,
      sheetHeight: true,
      sheetOrientation: true,
      marginTop: true,
      marginRight: true,
      marginBottom: true,
      marginLeft: true,
      gapHorizontal: true,
      gapVertical: true,
      badgeOrientation: true,
      duplexFlip: true,
      cropMarks: true,
    },
  });
}
