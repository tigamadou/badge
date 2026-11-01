"use client";

import { useState } from "react";
import { GenerationForm, type LayoutOption } from "@/components/staff/print/GenerationForm";
import { GenerationList, type GenerationRow } from "@/components/staff/print/GenerationList";

// Réunit le formulaire et l'historique : une génération créée apparaît aussitôt en tête.
export function GenerationsScreen({
  layouts,
  initial,
}: {
  layouts: LayoutOption[];
  initial: GenerationRow[];
}) {
  const [rows, setRows] = useState(initial);

  async function reload() {
    const res = await fetch("/api/platform/print/sheets");
    if (res.ok) setRows((await res.json()).generations);
  }

  return (
    <div className="space-y-6">
      <GenerationForm layouts={layouts} onCreated={() => void reload()} />
      <GenerationList generations={rows} onChange={setRows} />
    </div>
  );
}
