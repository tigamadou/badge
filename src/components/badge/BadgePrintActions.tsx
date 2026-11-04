"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatEventDate } from "@/lib/format-date";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { BadgeDocumentView } from "@/components/badge/BadgeDocumentView";
import { badgeDocumentUrl } from "@/lib/badge-document-client";

// Apercu HTML du badge (template de l'evenement), telechargement, impression du PDF
// dans un nouvel onglet et marquage "imprime" explicite. Un apercu, un telechargement
// ou une impression ne marque rien.
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
      <BadgeDocumentView src={badgeDocumentUrl(orgId, eventId, registrationId)} label="Aperçu du badge" />
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={`${pdfUrl}?download=1`}
          className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-mist"
        >
          Télécharger
        </a>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-mist"
        >
          Imprimer
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
