"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { RegistrationActions } from "./RegistrationActions";

type Reg = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  structure: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  badgePrinted: boolean;
  badgePrintedAt: string | null;
  allAccessGranted: boolean;
  rejectionReason: string | null;
  rejectionDetails: string | null;
  photo: string | null;
  idDocument: string | null;
  idDocumentType: string;
  idDocumentNumber: string;
  createdAt: string;
  category: { id: string; name: string; color: string; number: number };
};

export function RegistrationDetailPanel({
  orgId,
  eventId,
  registration,
}: {
  orgId: string;
  eventId: string;
  registration: Reg;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const r = registration;

  async function blockEmail() {
    if (!confirm(`Bloquer l'email ${r.email} sur cet événement ?`)) return;
    await fetch(`/api/admin/${orgId}/events/${eventId}/registrations/${r.id}/block-email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Bloqué via le détail inscription" }),
    });
    alert("Email bloqué.");
  }

  async function blockDocument() {
    if (!confirm(`Bloquer le document ${r.idDocumentNumber} ?`)) return;
    await fetch(`/api/admin/${orgId}/events/${eventId}/registrations/${r.id}/block-document`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Bloqué via le détail inscription" }),
    });
    alert("Document bloqué.");
  }

  async function toggleAllAccess() {
    await fetch(`/api/admin/${orgId}/events/${eventId}/registrations/${r.id}/all-access`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ allAccessGranted: !r.allAccessGranted }),
    });
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Supprimer définitivement l'inscription de ${r.firstName} ${r.lastName} ?`)) return;
    setBusy(true);
    await fetch(`/api/admin/${orgId}/events/${eventId}/registrations/${r.id}`, { method: "DELETE" });
    router.push(`/admin/${orgId}/events/${eventId}/registrations`);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded p-4 space-y-2">
        <h2 className="text-xl font-semibold">
          {r.firstName} {r.lastName}
        </h2>
        <div className="text-sm text-gray-600">
          {r.email} — {r.structure}
        </div>
        <div className="text-sm">
          Catégorie :
          <span className="inline-block w-3 h-3 rounded mx-1 align-middle" style={{ background: r.category.color }} />
          {r.category.name} (#{r.category.number})
        </div>
        <div className="text-sm">
          Pièce : {r.idDocumentType} {r.idDocumentNumber}
        </div>
        <div className="text-sm">
          Statut : {r.status}
          {r.badgePrinted && (
            <span className="ml-2 text-xs text-gray-500">
              — badge imprimé le {new Date(r.badgePrintedAt!).toLocaleString("fr-FR")}
            </span>
          )}
        </div>
        {r.rejectionReason && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
            <strong>Motif de rejet :</strong> {r.rejectionReason}
            {r.rejectionDetails && <div className="mt-1 text-xs">{r.rejectionDetails}</div>}
          </div>
        )}
        <RegistrationActions
          orgId={orgId}
          eventId={eventId}
          registrationId={r.id}
          status={r.status}
          onChanged={() => router.refresh()}
        />
      </div>

      <div className="bg-white border rounded p-4 space-y-2">
        <h3 className="font-semibold">Pièces jointes</h3>
        <div className="flex gap-4 flex-wrap">
          {r.photo ? (
            <a href={`/api/files/${r.photo}`} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
              Voir la photo
            </a>
          ) : (
            <span className="text-sm text-gray-500">Pas de photo</span>
          )}
          {r.idDocument ? (
            <a href={`/api/files/${r.idDocument}`} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
              Voir la pièce d&apos;identité
            </a>
          ) : (
            <span className="text-sm text-gray-500">Pas de pièce d&apos;identité</span>
          )}
        </div>
      </div>

      <div className="bg-white border rounded p-4 space-y-3">
        <h3 className="font-semibold">Actions avancées</h3>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" onClick={toggleAllAccess} disabled={busy}>
            {r.allAccessGranted ? "Retirer ALL ACCESS" : "Activer ALL ACCESS"}
          </Button>
          <Link href={`/admin/${orgId}/events/${eventId}/badges/${r.id}`}>
            <Button variant="secondary">Voir le badge</Button>
          </Link>
          <Button variant="secondary" onClick={blockEmail} disabled={busy}>
            Bloquer cet email
          </Button>
          <Button variant="secondary" onClick={blockDocument} disabled={busy}>
            Bloquer ce document
          </Button>
          <Button variant="secondary" onClick={remove} disabled={busy}>
            Supprimer
          </Button>
        </div>
      </div>
    </div>
  );
}
