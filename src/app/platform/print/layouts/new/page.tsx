import { redirect } from "next/navigation";
import { LayoutEditor } from "@/components/staff/print/LayoutEditor";
import {
  canWriteLayouts,
  loadTemplateOptions,
} from "@/lib/print-sheets/layout-page-data";

export default async function NewPrintLayoutPage() {
  // La creation est reservee a STAFF_ADMIN+ (l'API le verifie aussi).
  if (!(await canWriteLayouts())) redirect("/platform/print/layouts");
  const templates = await loadTemplateOptions();
  return (
    <LayoutEditor
      layout={null}
      templates={templates}
      canWrite
    />
  );
}
