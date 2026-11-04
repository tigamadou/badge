import type { ReactNode } from "react";
import { countOrdersToGenerate } from "@/lib/print-sheets/order-queue";
import { SheetsTabs } from "@/components/staff/print/sheets/SheetsTabs";
import { requireSheetsStaff } from "./sheets-data";

export const dynamic = "force-dynamic";

export default async function PrintSheetsLayout({ children }: { children: ReactNode }) {
  await requireSheetsStaff();
  const pendingCount = await countOrdersToGenerate();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-navy">Planches d&apos;impression</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Planches PDF prêtes à imprimer : une par commande payée, et la génération libre
        </p>
      </div>
      <SheetsTabs pendingCount={pendingCount} />
      {children}
    </div>
  );
}
