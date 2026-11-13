"use client";

import { useState, type ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { GenerationForm, type LayoutOption, type LinkedPrintRequest } from "@/components/staff/print/GenerationForm";
import { GenerationList, type GenerationRow } from "@/components/staff/print/GenerationList";
import { mergeRowsById } from "@/components/staff/print/sheets/merge-rows";

// Réunit le formulaire et l'historique : une génération créée apparaît aussitôt en tête.
export function GenerationsScreen({
  layouts,
  canGenerate,
  initial,
  printRequest,
  pagination,
}: {
  layouts: LayoutOption[];
  canGenerate: boolean;
  initial: GenerationRow[];
  printRequest?: LinkedPrintRequest;
  // Pagination par l'URL, rendue par la page serveur.
  pagination?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Lignes de la page courante, mises a jour par le polling (qui renvoie la liste non paginee).
  const [polled, setPolled] = useState<{ from: GenerationRow[]; rows: GenerationRow[] } | null>(null);
  const rows = polled && polled.from === initial ? polled.rows : initial;

  // Une generation creee apparait en tete : retour a la page 1 et relecture de la tranche serveur.
  function reload() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {canGenerate && <GenerationForm layouts={layouts} onCreated={reload} printRequest={printRequest} />}
      <GenerationList
        generations={rows}
        onChange={(fresh) => setPolled({ from: initial, rows: mergeRowsById(rows, fresh) })}
      />
      {pagination}
    </div>
  );
}
