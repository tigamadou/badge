"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";

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
  }

  if (!registration) return <p>Chargement...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Détail de l&apos;inscription</h1>

      <div className="max-w-xl">
        <div className="bg-white rounded-lg shadow overflow-hidden">
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
                <div className="w-32 h-32 rounded-full border-4 border-white shadow-md bg-gray-200 flex items-center justify-center">
                  <span className="text-3xl text-gray-400">
                    {registration.firstName[0]}{registration.lastName[0]}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-20 pb-6 px-6 text-center">
            <h2 className="text-xl font-bold">{registration.firstName} {registration.lastName}</h2>
            <p className="text-gray-500 text-sm mt-1">{registration.structure}</p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: registration.team.color }} />
              <span className="text-sm font-medium">{registration.team.name}</span>
            </div>
            <div className="mt-2">
              <StatusBadge status={registration.status} />
            </div>
          </div>

          <div className="border-t px-6 py-4">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Email</dt>
                <dd className="text-right">{registration.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Type de document</dt>
                <dd>{registration.idDocumentType}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">N° document</dt>
                <dd className="font-mono">{registration.idDocumentNumber}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">ID inscription</dt>
                <dd className="font-mono text-xs">{registration.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Date</dt>
                <dd>{new Date(registration.createdAt).toLocaleDateString("fr-FR")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Pièce d&apos;identité</dt>
                <dd>{registration.idDocumentType} — N° {registration.idDocumentNumber}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Fichier</dt>
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

          <div className="border-t px-6 py-4 flex flex-col items-center gap-3">
            <div className="flex gap-3">
              {registration.status !== "APPROVED" && (
                <Button onClick={() => updateStatus("APPROVED")}>Valider</Button>
              )}
              {registration.status !== "REJECTED" && (
                <Button variant="danger" onClick={() => updateStatus("REJECTED")}>Rejeter</Button>
              )}
            </div>
            {registration.status === "APPROVED" && (
              <Link href="/admin/badges" className="text-sm text-blue-600 hover:underline">
                Voir le badge dans la page Badges
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
