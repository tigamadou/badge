"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { generateQRCodeDataURL } from "@/lib/qrcode";
import { formatEventDate } from "@/lib/format-date";

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

interface EventData {
  id: string;
  title: string;
  location: string;
  date: string;
  logo: string | null;
}

export default function BadgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [hasContact, setHasContact] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [showAllAccessModal, setShowAllAccessModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    fetch(`/api/registrations/${id}`).then((r) => r.json()).then(setRegistration);
    fetch("/api/event").then((r) => r.json()).then(setEvent);
    fetch("/api/settings").then((r) => r.json()).then((s) => {
      setHasContact(Boolean(s?.contactEmail && s?.contactPhone));
    });
    fetch("/api/auth/session").then((r) => r.json()).then((session) => {
      if (session?.user?.role) setUserRole(session.user.role);
    });
  }, [id]);

  useEffect(() => {
    if (registration) {
      generateQRCodeDataURL(registration.id).then(setQrCodeDataUrl);
    }
  }, [registration]);

  async function toggleAllAccess() {
    await fetch(`/api/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allAccessGranted: !registration!.allAccessGranted }),
    });
    const res = await fetch(`/api/registrations/${id}`);
    setRegistration(await res.json());
    setShowAllAccessModal(false);
  }

  async function markAsPrinted() {
    await fetch(`/api/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badgePrinted: true }),
    });
    const res = await fetch(`/api/registrations/${id}`);
    setRegistration(await res.json());
    setShowPrintModal(false);
  }

  if (!registration || !event) return <p>Chargement...</p>;

  if (registration.status !== "APPROVED") {
    return (
      <div>
        <h1 className="text-xl font-semibold text-slate-900 mb-4">Badge non disponible</h1>
        <p className="text-slate-500 mb-4">Cette inscription n&apos;est pas encore validée.</p>
        <Link href="/admin/badges" className="text-indigo-600 hover:text-indigo-700">Retour aux badges</Link>
      </div>
    );
  }

  const badgeEvent = {
    id: event.id,
    title: event.title,
    location: event.location,
    date: formatEventDate(event.date),
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
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/badges" className="text-slate-500 hover:text-slate-700">
          &larr; Badges
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">
          Badge de {registration.firstName} {registration.lastName}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche : Infos + Actions */}
        <div className="space-y-6">
          {/* Infos */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="h-3" style={{ backgroundColor: registration.team.color }} />
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                {registration.photo ? (
                  <img
                    src={`/api/files/${registration.photo}`}
                    alt={`${registration.firstName} ${registration.lastName}`}
                    className="w-16 h-16 rounded-full object-cover border-2 border-slate-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center">
                    <span className="text-xl text-slate-400">
                      {registration.firstName[0]}{registration.lastName[0]}
                    </span>
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold">{registration.firstName} {registration.lastName}</h2>
                  <p className="text-slate-500 text-sm">{registration.structure}</p>
                </div>
              </div>

              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Catégorie</dt>
                  <dd className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: registration.team.color }} />
                    {registration.team.name}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Email</dt>
                  <dd>{registration.email}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">ID</dt>
                  <dd className="font-mono text-xs">{registration.id}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Statut impression</dt>
                  <dd>
                    {registration.badgePrinted ? (
                      <span className="text-emerald-600 font-medium">
                        Imprimé le {new Date(registration.badgePrintedAt!).toLocaleDateString("fr-FR")}
                      </span>
                    ) : (
                      <span className="text-amber-500">Non imprimé</span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">ALL ACCESS</dt>
                  <dd>
                    {registration.allAccessGranted ? (
                      <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">OUI</span>
                    ) : (
                      <span className="text-slate-400">Non</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
            <h3 className="font-semibold text-sm text-slate-700 mb-2">Actions</h3>
            {userRole !== "SUPER_ADMIN" && (
            <div className="flex flex-col gap-2 justify-between items-center">
              {!registration.badgePrinted && (
                <Button
                  variant={registration.allAccessGranted ? "danger" : "secondary"}
                  onClick={() => setShowAllAccessModal(true)}
                >
                  {registration.allAccessGranted ? "Désactiver ALL ACCESS" : "Activer ALL ACCESS"}
                </Button>
              )}
              {hasContact && !registration.badgePrinted && (
                <Button variant="secondary" onClick={() => setShowPrintModal(true)}>
                  Marquer comme imprimé
                </Button>
              )}
            </div>
            )}
            {userRole !== "SUPER_ADMIN" && (
            <div className="mt-4">
              {!hasContact && !registration.badgePrinted && (
                <p className="text-sm text-amber-600">
                  Configurez les informations de contact dans les{" "}
                  <Link href="/admin/settings" className="underline">paramètres</Link>
                  {" "}pour pouvoir confirmer l&apos;impression.
                </p>
              )}
            </div>
            )}
            <div className="flex flex-col gap-2 justify-between items-center">
              {qrCodeDataUrl && (
                <BadgeDownload
                  registration={badgeRegistration}
                  team={registration.team}
                  event={badgeEvent}
                  qrCodeDataUrl={qrCodeDataUrl}
                  allAccessGranted={registration.allAccessGranted}
                />
              )}

              <Link
                href={`/admin/registrations/${registration.id}`}
                className="block text-sm text-indigo-600 hover:text-indigo-700"
              >
                Voir l&apos;inscription
              </Link>
            </div>
          </div>
        </div>

        {/* Colonne droite : Aperçu du badge */}
        {qrCodeDataUrl && (
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Aperçu du badge</h2>
            <BadgePreview
              registration={badgeRegistration}
              team={registration.team}
              event={badgeEvent}
              qrCodeDataUrl={qrCodeDataUrl}
              allAccessGranted={registration.allAccessGranted}
            />
          </div>
        )}
      </div>

      <Modal
        open={showAllAccessModal}
        title={registration.allAccessGranted ? "Désactiver ALL ACCESS" : "Activer ALL ACCESS"}
        onConfirm={toggleAllAccess}
        onCancel={() => setShowAllAccessModal(false)}
        confirmLabel="Confirmer"
        confirmVariant={registration.allAccessGranted ? "danger" : "primary"}
      >
        <p className="text-sm text-slate-600">
          {registration.allAccessGranted
            ? `Voulez-vous vraiment désactiver le ALL ACCESS pour ${registration.firstName} ${registration.lastName} ? Le badge sera mis à jour.`
            : `Voulez-vous vraiment activer le ALL ACCESS pour ${registration.firstName} ${registration.lastName} ? Le badge sera mis à jour.`}
        </p>
      </Modal>

      <Modal
        open={showPrintModal}
        title="Confirmer l'impression"
        onConfirm={markAsPrinted}
        onCancel={() => setShowPrintModal(false)}
        confirmLabel="Confirmer l'impression"
        confirmVariant="primary"
      >
        <p className="text-sm text-slate-600">
          Voulez-vous vraiment marquer le badge de {registration.firstName} {registration.lastName} comme imprimé ?
          Un email de notification sera envoyé à {registration.email}.
        </p>
      </Modal>
    </div>
  );
}
