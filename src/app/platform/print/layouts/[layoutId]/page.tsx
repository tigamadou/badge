import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LayoutEditor } from "@/components/staff/print/LayoutEditor";
import {
  canWriteLayouts,
  loadTemplateOptions,
  toLayoutRow,
  witnessFromParams,
  type WitnessParams,
} from "@/lib/print-sheets/layout-page-data";

export default async function EditPrintLayoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ layoutId: string }>;
  searchParams: Promise<WitnessParams>;
}) {
  const { layoutId } = await params;
  const [layout, canWrite, templates] = await Promise.all([
    prisma.printSheetLayout.findUnique({ where: { id: layoutId } }),
    canWriteLayouts(),
    loadTemplateOptions(),
  ]);
  if (!layout || layout.archived) notFound();

  return (
    <LayoutEditor
      // La cle remonte l'editeur si l'on passe d'un gabarit a l'autre.
      key={layout.id}
      layout={toLayoutRow(layout)}
      templates={templates}
      canWrite={canWrite}
      initialWitness={witnessFromParams(await searchParams)}
    />
  );
}
