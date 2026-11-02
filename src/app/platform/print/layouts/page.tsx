import { prisma } from "@/lib/prisma";
import { LayoutList } from "@/components/staff/print/LayoutList";
import {
  canWriteLayouts,
  toLayoutRow,
} from "@/lib/print-sheets/layout-page-data";

export default async function PrintLayoutsPage() {
  const [canWrite, layouts] = await Promise.all([
    canWriteLayouts(),
    prisma.printSheetLayout.findMany({ where: { archived: false }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Gabarits d&apos;impression</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Formats de planche, marges et espacements utilisés pour imprimer les badges
        </p>
      </div>
      <LayoutList
        layouts={layouts.map(toLayoutRow)}
        canWrite={canWrite}
      />
    </div>
  );
}
