import { redirect } from "next/navigation";
import { LayoutEditor } from "@/components/staff/print/LayoutEditor";
import {
  canWriteLayouts,
  loadTemplateOptions,
  witnessFromParams,
  type WitnessParams,
} from "@/lib/print-sheets/layout-page-data";

export default async function NewPrintLayoutPage({ searchParams }: { searchParams: Promise<WitnessParams> }) {
  // La creation est reservee a STAFF_ADMIN+ (l'API le verifie aussi).
  if (!(await canWriteLayouts())) redirect("/platform/print/layouts");
  const templates = await loadTemplateOptions();
  return (
    <LayoutEditor
      layout={null}
      templates={templates}
      canWrite
      initialWitness={witnessFromParams(await searchParams)}
    />
  );
}
