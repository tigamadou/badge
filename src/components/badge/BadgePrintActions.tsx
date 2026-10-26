"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatEventDate } from "@/lib/format-date";
import { useAsyncAction } from "@/hooks/useAsyncAction";

// Apercu du PDF serveur (template de l'evenement), telechargement et marquage
// "imprime" explicite d'un badge. Un apercu ou un telechargement ne marque rien.
export function BadgePrintActions({
  orgId,
  eventId,
  registrationId,
  approved,
  archived,
  printed: initialPrinted,
  printedAt: initialPrintedAt,
}: {
  orgId: string;
  eventId: string;
  registrationId: string;
  approved: boolean;
  archived: boolean;
  printed: boolean;
  printedAt: string | null;
}) {
  const [printed, setPrinted] = useState(initialPrinted);
  const [printedAt, setPrintedAt] = useState(initialPrintedAt);

  const pdfUrl = `/api/org/${orgId}/events/${eventId}/badges/${registrationId}`;
  const blocked = archived
    ? "Événement archivé : le marquage est désactivé."
    : !approved
      ? "Seules les inscriptions approuvées peuvent être marquées imprimées."
      : null;

  // Le message de l'API (409 « Seules les inscriptions approuvées… ») passe par toastApiError.
  const markPrinted = useAsyncAction(
    async () => {
      const res = await fetch(`/api/org/${orgId}/events/${eventId}/registrations/${registrationId}/print`, {
        method: "POST",
      });
      if (!res.ok) throw res;
    },
    {
      success: "Badge marqué imprimé.",
      error: "Le marquage a échoué.",
      onSuccess: () => {
        setPrinted(true);
        setPrintedAt(new Date().toISOString());
      },
    },
  );

  return (
    <div className="space-y-4">
      <iframe
        title="Aperçu du badge"
        src={pdfUrl}
        className="h-[640px] w-full rounded-xl border border-slate-200 bg-white"
      />
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={`${pdfUrl}?download=1`}
          className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
        >
          Télécharger
        </a>
        <Button
          type="button"
          onClick={() => void markPrinted.run()}
          loading={markPrinted.pending}
          disabled={blocked !== null}
        >
          Marquer imprimé
        </Button>
        <span className="text-[13px] text-slate-500">
          {printed ? (printedAt ? `Imprimé le ${formatEventDate(printedAt)}` : "Imprimé") : "Non imprimé"}
        </span>
      </div>
      {blocked && <p className="text-[13px] text-slate-500">{blocked}</p>}
    </div>
  );
}
