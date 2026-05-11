"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface Registration {
  id: string;
  lastName: string;
  firstName: string;
  email: string;
  structure: string;
  photo: string | null;
  idDocumentType: string;
  idDocumentNumber: string;
  idDocument: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  badgePrinted: boolean;
  badgePrintedAt: string | null;
  allAccessGranted: boolean;
  createdAt: string;
  team: { id: string; name: string; color: string; number: number };
}

export default function RegistrationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [confirmAction, setConfirmAction] = useState<"APPROVED" | "REJECTED" | null>(null);

  useEffect(() => {
    fetch(`/api/registrations/${id}`).then((r) => r.json()).then(setRegistration);
  }, [id]);

  async function updateStatus(status: string) {
    await fetch(`/api/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const res = await fetch(`/api/registrations/${id}`);
    setRegistration(await res.json());
    setConfirmAction(null);
  }

  if (!registration) return <p>Chargement...</p>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/registrations" className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">Détail de l&apos;inscription</h1>
      </div>

      <div className="max-w-xl">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* En-tête avec couleur de l'équipe */}
          <div className="h-24 relative" style={{ backgroundColor: registration.team.color }}>
            <div className="absolute -bottom-16 left-1/2 -translate-x-1/2">
              {registration.photo ? (
                <a href={`/api/files/${registration.photo}`} target="_blank" rel="noopener noreferrer">
                  <img
                    src={`/api/files/${registration.photo}`}
                    alt={`${registration.firstName} ${registration.lastName}`}
                    className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-md hover:opacity-90"
                  />
                </a>
              ) : (
                <div className="w-32 h-32 rounded-full border-4 border-white shadow-md bg-slate-200 flex items-center justify-center">
                  <span className="text-3xl text-slate-400">
                    {registration.firstName[0]}{registration.lastName[0]}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-20 pb-6 px-6 text-center">
            <h2 className="text-xl font-bold">{registration.firstName} {registration.lastName}</h2>
            <p className="text-slate-500 text-sm mt-1">{registration.structure}</p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: registration.team.color }} />
              <span className="text-sm font-medium">{registration.team.name}</span>
            </div>
            <div className="mt-2">
              <StatusBadge status={registration.status} />
            </div>
          </div>

          <div className="border-t border-slate-100 px-6 py-4">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Email</dt>
                <dd className="text-right">{registration.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Type de document</dt>
                <dd>{registration.idDocumentType}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">N° document</dt>
                <dd className="font-mono">{registration.idDocumentNumber}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">ID inscription</dt>
                <dd className="font-mono text-xs">{registration.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Date</dt>
                <dd>{new Date(registration.createdAt).toLocaleDateString("fr-FR")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Pièce d&apos;identité</dt>
                <dd>{registration.idDocumentType} — N° {registration.idDocumentNumber}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Fichier</dt>
                <dd>
                  {registration.idDocument ? (
                    <a href={`/api/files/${registration.idDocument}`} target="_blank" rel="noopener noreferrer">
                      <img src={`/api/files/${registration.idDocument}`} alt="Document d'identité" className="w-full hover:opacity-90 max-w-40 object-contain" />
                    </a>
                  ) : "Aucun"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="border-t border-slate-100 px-6 py-4 flex flex-col items-center gap-3">
            <div className="flex gap-3">
              {registration.status !== "APPROVED" && (
                <Button onClick={() => setConfirmAction("APPROVED")}>Valider</Button>
              )}
              {registration.status !== "REJECTED" && (
                <Button variant="danger" onClick={() => setConfirmAction("REJECTED")}>Rejeter</Button>
              )}
            </div>
            {registration.status === "APPROVED" && (
              <Link href="/admin/badges" className="text-sm text-indigo-600 hover:text-indigo-700">
                Voir le badge dans la page Badges
              </Link>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={confirmAction !== null}
        title={confirmAction === "APPROVED" ? "Confirmer la validation" : "Confirmer le rejet"}
        confirmLabel={confirmAction === "APPROVED" ? "Valider" : "Rejeter"}
        confirmVariant={confirmAction === "APPROVED" ? "primary" : "danger"}
        onConfirm={() => confirmAction && updateStatus(confirmAction)}
        onCancel={() => setConfirmAction(null)}
      >
        <p className="text-sm text-slate-600">
          {confirmAction === "APPROVED"
            ? `Voulez-vous valider l'inscription de ${registration.firstName} ${registration.lastName} ?`
            : `Voulez-vous rejeter l'inscription de ${registration.firstName} ${registration.lastName} ?`}
        </p>
      </Modal>
    </div>
  );
}
