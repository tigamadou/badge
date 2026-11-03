"use client";

import { useRouter } from "next/navigation";
import { GenerationForm, type LayoutOption, type LinkedPrintRequest } from "@/components/staff/print/GenerationForm";

// Génération depuis le lien d'une commande : une fois lancée, on suit la planche dans « Générées ».
export function LinkedOrderSheet({
  layouts,
  printRequest,
}: {
  layouts: LayoutOption[];
  printRequest: LinkedPrintRequest;
}) {
  const router = useRouter();
  return (
    <GenerationForm
      layouts={layouts}
      printRequest={printRequest}
      onCreated={() => router.push("/platform/print/sheets/generated")}
    />
  );
}
