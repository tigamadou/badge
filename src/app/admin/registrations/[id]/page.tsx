"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { generateQRCodeDataURL } from "@/lib/qrcode";

const BadgePreview = dynamic(
  () => import("@/components/badge/BadgePreview").then((m) => m.BadgePreview),
  { ssr: false }
);
const BadgeDownload = dynamic(
  () => import("@/components/badge/BadgeDownload").then((m) => m.BadgeDownload),
  { ssr: false }
);

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
  const [event, setEvent] = useState<{ id: string; title: string; location: string; date: string; logo: string | null; contactEmail: string | null; contactPhone: string | null } | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");

  useEffect(() => {
    fetch(`/api/registrations/${id}`).then((r) => r.json()).then(setRegistration);
    fetch("/api/event").then((r) => r.json()).then(setEvent);
  }, [id]);

  useEffect(() => {
    if (registration) {
      generateQRCodeDataURL(registration.id).then(setQrCodeDataUrl);
    }
  }, [registration]);

  async function updateStatus(status: string) {
    await fetch(`/api/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const res = await fetch(`/api/registrations/${id}`);
    setRegistration(await res.json());
  }

  async function toggleAllAccess() {
    await fetch(`/api/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allAccessGranted: !registration!.allAccessGranted }),
    });
    const res = await fetch(`/api/registrations/${id}`);
    setRegistration(await res.json());
  }

  async function markAsPrinted() {
    await fetch(`/api/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badgePrinted: true }),
    });
    const res = await fetch(`/api/registrations/${id}`);
    setRegistration(await res.json());
  }

  if (!registration || !event) return <p>Chargement...</p>;

  const badgeEvent = {
    id: event.id,
    title: event.title,
    location: event.location,
    date: event.date,
    logo: event.logo ? `/api/files/${event.logo}` : "",
  };

  const badgeRegistration = {
    id: registration.id,
    lastName: registration.lastName,
    firstName: registration.firstName,
    structure: registration.structure,
    photo: registration.photo ? `/api/files/${registration.photo}` : "",
    email: registration.email,
    idDocumentType: registration.idDocumentType,
    idDocumentNumber: registration.idDocumentNumber,
    idDocument: registration.idDocument || "",
    teamId: registration.team.id,
    status: registration.status,
    allAccessGranted: registration.allAccessGranted,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Détail de l&apos;inscription</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche : Profil */}
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
            {registration.status === "APPROVED" && !registration.badgePrinted && (
              <Button
                variant={registration.allAccessGranted ? "danger" : "secondary"}
                onClick={toggleAllAccess}
              >
                {registration.allAccessGranted ? "Désactiver ALL ACCESS" : "Activer ALL ACCESS"}
              </Button>
            )}
            {registration.status === "APPROVED" && !registration.badgePrinted && event?.contactEmail && event?.contactPhone && (
              <Button variant="secondary" onClick={markAsPrinted}>
                Marquer comme imprimé
              </Button>
            )}
            {registration.status === "APPROVED" && !registration.badgePrinted && (!event?.contactEmail || !event?.contactPhone) && (
              <p className="text-sm text-amber-600">
                Configurez l&apos;email et le téléphone de contact dans les <Link href="/admin/event" className="underline">paramètres de l&apos;événement</Link> pour pouvoir confirmer l&apos;impression.
              </p>
            )}
            {registration.badgePrinted && registration.badgePrintedAt && (
              <p className="text-sm text-green-600">
                Badge imprimé le {new Date(registration.badgePrintedAt).toLocaleDateString("fr-FR")}
              </p>
            )}
          </div>
        </div>

        {/* Colonne centrale : Pièce d'identité */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Pièce d&apos;identité</h2>
          <p className="text-sm text-gray-500 mb-3">
            {registration.idDocumentType} — N° {registration.idDocumentNumber}
          </p>
          {registration.idDocument ? (
            <a href={`/api/files/${registration.idDocument}`} target="_blank" rel="noopener noreferrer">
              {registration.idDocument.endsWith(".pdf") ? (
                <div className="w-full aspect-[3/4] rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100">
                  <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span className="text-gray-500 text-sm font-medium">Document PDF</span>
                  <span className="text-gray-400 text-xs mt-1">Cliquer pour ouvrir</span>
                </div>
              ) : (
                <img
                  src={`/api/files/${registration.idDocument}`}
                  alt="Document d'identité"
                  className="w-full rounded-lg border hover:opacity-90"
                />
              )}
            </a>
          ) : (
            <div className="w-full aspect-[3/4] rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
              <span className="text-gray-400 text-sm">Aucun document fourni</span>
            </div>
          )}
        </div>

        {/* Colonne droite : Badge */}
        {registration.status === "APPROVED" && qrCodeDataUrl && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Badge</h2>
              <Link
                href={`/badge-preview/${registration.id}`}
                target="_blank"
                className="text-sm text-blue-600 hover:underline"
              >
                Aperçu web
              </Link>
            </div>
            <BadgePreview
              registration={badgeRegistration}
              team={registration.team}
              event={badgeEvent}
              qrCodeDataUrl={qrCodeDataUrl}
              allAccessGranted={registration.allAccessGranted}
            />
            <div className="mt-4">
              <BadgeDownload
                registration={badgeRegistration}
                team={registration.team}
                event={badgeEvent}
                qrCodeDataUrl={qrCodeDataUrl}
                allAccessGranted={registration.allAccessGranted}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
