"use client";

import { useState } from "react";
import { toastError } from "@/lib/toast";
import { GenerationForm, type LayoutOption, type LinkedPrintRequest } from "@/components/staff/print/GenerationForm";
import { GenerationList, type GenerationRow } from "@/components/staff/print/GenerationList";

// Réunit le formulaire et l'historique : une génération créée apparaît aussitôt en tête.
export function GenerationsScreen({
  layouts,
  initial,
  printRequest,
}: {
  layouts: LayoutOption[];
  initial: GenerationRow[];
  printRequest?: LinkedPrintRequest;
}) {
  const [rows, setRows] = useState(initial);

  async function reload() {
    try {
      const res = await fetch("/api/platform/print/sheets");
      if (!res.ok) throw res;
      setRows((await res.json()).generations);
    } catch {
      toastError("Impossible d'actualiser l'historique. Rechargez la page.");
    }
  }

  return (
    <div className="space-y-6">
      <GenerationForm layouts={layouts} onCreated={() => void reload()} printRequest={printRequest} />
      <GenerationList generations={rows} onChange={setRows} />
    </div>
  );
}
