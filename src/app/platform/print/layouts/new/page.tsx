import { redirect } from "next/navigation";
import { requirePlatformPage } from "@/app/platform/page-guard";
import { LayoutEditor } from "@/components/staff/print/LayoutEditor";
import {
  canWriteLayouts,
  loadTemplateOptions,
} from "@/lib/print-sheets/layout-page-data";

export default async function NewPrintLayoutPage() {
  await requirePlatformPage("print.layouts.read", "/platform/print/layouts");
  // La creation exige `print.layouts.manage` (l'API le verifie aussi).
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
