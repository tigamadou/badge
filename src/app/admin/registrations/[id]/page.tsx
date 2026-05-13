"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

const REJECTION_REASONS = [
  "Photo non conforme",
  "Document d'identité illisible",
  "Document d'identité expiré",
  "Informations incorrectes",
  "Doublon d'inscription",
  "Catégorie non autorisée",
  "Autre",
];

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
  rejectionReason: string | null;
  rejectionDetails: string | null;
  editToken: string | null;
  editTokenExpiresAt: string | null;
  createdAt: string;
  team: { id: string; name: string; color: string; number: number };
  emailBlocked?: boolean;
  snapshots: {
    id: string;
    lastName: string;
    firstName: string;
    email: string;
    structure: string;
    teamId: string;
    idDocumentType: string;
    idDocumentNumber: string;
    photo: string | null;
    idDocument: string | null;
    createdAt: string;
  }[];
}

interface DuplicateMatch {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  idDocumentNumber: string;
  idDocumentType: string;
  structure: string;
  status: string;
  createdAt: string;
  team: { id: string; name: string; color: string };
  matchReasons: string[];
}

export default function RegistrationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [contactsConfigured, setContactsConfigured] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [confirmAction, setConfirmAction] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionDetails, setRejectionDetails] = useState("");
  const [emailBlocked, setEmailBlocked] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [sendingEditLink, setSendingEditLink] = useState(false);
  const [editLinkSent, setEditLinkSent] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(true);
  const [confirmEditLink, setConfirmEditLink] = useState(false);

  useEffect(() => {
    fetch(`/api/registrations/${id}`).then((r) => r.json()).then((data) => {
      setRegistration(data);
      setEmailBlocked(data.emailBlocked || false);
    });
    fetch(`/api/registrations/${id}/duplicates`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDuplicates(data);
      })
      .finally(() => setDuplicatesLoading(false));
    fetch("/api/settings").then((r) => r.json()).then((settings) => {
      if (settings) {
        setContactsConfigured(!!(settings.contactEmail && settings.contactPhone));
      } else {
        setContactsConfigured(false);
      }
    });
    fetch("/api/auth/session").then((r) => r.json()).then((session) => {
      if (session?.user?.role) setUserRole(session.user.role);
    });
  }, [id]);

  async function blockEmail() {
    await fetch(`/api/registrations/${id}/block-email`, { method: "POST" });
    setEmailBlocked(true);
    setConfirmBlock(false);
  }

  async function unblockEmail() {
    await fetch(`/api/registrations/${id}/block-email`, { method: "DELETE" });
    setEmailBlocked(false);
  }

  async function sendEditLink() {
    setSendingEditLink(true);
    const res = await fetch(`/api/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send-edit-link" }),
    });
    setSendingEditLink(false);
    if (res.ok) {
      setEditLinkSent(true);
      const updated = await fetch(`/api/registrations/${id}`);
      setRegistration(await updated.json());
    }
  }

  async function updateStatus(status: string) {
    const body: Record<string, string> = { status };
    if (status === "REJECTED") {
      body.rejectionReason = rejectionReason;
      body.rejectionDetails = rejectionDetails;
    }
    await fetch(`/api/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const res = await fetch(`/api/registrations/${id}`);
    setRegistration(await res.json());
    setConfirmAction(null);
    setRejectionReason("");
    setRejectionDetails("");
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

      {!duplicatesLoading && duplicates.length > 0 && (
        <div className={`mb-4 rounded-xl border px-4 py-3 ${
          duplicates.length >= 3
            ? "bg-rose-50 border-rose-200"
            : duplicates.length === 2
              ? "bg-orange-50 border-orange-200"
              : "bg-amber-50 border-amber-200"
        }`}>
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 flex-shrink-0 ${
              duplicates.length >= 3 ? "text-rose-500" : duplicates.length === 2 ? "text-orange-500" : "text-amber-500"
            }`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className={`text-sm font-medium ${
              duplicates.length >= 3 ? "text-rose-700" : duplicates.length === 2 ? "text-orange-700" : "text-amber-700"
            }`}>
              {duplicates.length >= 3
                ? `Attention : ${duplicates.length} inscriptions similaires détectées — risque élevé de doublon`
                : duplicates.length === 2
                  ? `${duplicates.length} inscriptions similaires détectées — doublon possible`
                  : "1 inscription similaire détectée — vérification recommandée"}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Colonne gauche — Informations */}
        <div className="flex-1 max-w-xl">
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
              <p className="text-slate-400 text-xs mt-2">
                Inscrit le {new Date(registration.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
              </p>
            </div>

            {registration.status === "REJECTED" && registration.rejectionReason && (
              <div className="border-t border-slate-100 px-6 py-4 bg-rose-50">
                <p className="text-sm font-medium text-rose-700 mb-1">Motif du rejet</p>
                <p className="text-sm text-rose-600">{registration.rejectionReason}</p>
                {registration.rejectionDetails && (
                  <p className="text-sm text-rose-500 mt-1">{registration.rejectionDetails}</p>
                )}
              </div>
            )}

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

            {registration.snapshots && registration.snapshots.length > 1 && (
              <div className="border-t border-slate-100 px-6 py-4">
                <p className="text-sm font-medium text-slate-700 mb-3">Historique des soumissions ({registration.snapshots.length})</p>
                <div className="space-y-3">
                  {registration.snapshots.map((snapshot, index) => (
                    <div key={snapshot.id} className="text-sm border border-slate-200 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-slate-700">
                          {index === 0 ? "Dernière soumission" : `Soumission ${registration.snapshots.length - index}`}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(snapshot.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <dl className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Nom</dt>
                          <dd>{snapshot.lastName} {snapshot.firstName}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Email</dt>
                          <dd>{snapshot.email}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Structure</dt>
                          <dd>{snapshot.structure}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Document</dt>
                          <dd>{snapshot.idDocumentType} — {snapshot.idDocumentNumber}</dd>
                        </div>
                        {snapshot.photo && (
                          <div className="mt-2">
                            <a href={`/api/files/${snapshot.photo}`} target="_blank" rel="noopener noreferrer">
                              <img src={`/api/files/${snapshot.photo}`} alt="Photo" className="w-16 h-16 rounded object-cover" />
                            </a>
                          </div>
                        )}
                      </dl>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Colonne droite — Actions */}
        {userRole !== "SUPER_ADMIN" && (
        <div className="w-full lg:w-72 space-y-4">
          {/* Actions de statut */}
          {registration.status === "PENDING" && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <p className="text-sm font-medium text-slate-700">Actions</p>
              {!contactsConfigured && (
                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <p>Veuillez configurer les informations de contact dans les <Link href="/admin/settings" className="underline font-medium">paramètres</Link> avant de pouvoir valider ou rejeter.</p>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button onClick={() => setConfirmAction("APPROVED")} disabled={!contactsConfigured}>Valider</Button>
                <Button variant="danger" onClick={() => setConfirmAction("REJECTED")} disabled={!contactsConfigured}>Rejeter</Button>
              </div>
            </div>
          )}

          {registration.status === "APPROVED" && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <Link href="/admin/badges" className="text-sm text-indigo-600 hover:text-indigo-700 block">
                Voir le badge dans la page Badges
              </Link>
              {contactsConfigured && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-sm font-medium text-slate-700 mb-2">Modification</p>
                  {editLinkSent ? (
                    <p className="text-sm text-emerald-600">Lien de modification envoyé.</p>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => setConfirmEditLink(true)}
                      disabled={sendingEditLink}
                    >
                      {sendingEditLink ? "Envoi..." : "Envoyer un lien de modification"}
                    </Button>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    L&apos;inscrit pourra modifier son inscription. Elle repassera en attente de validation.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Lien de modification (rejetée + non bloquée) */}
          {registration.status === "REJECTED" && registration.editToken && !emailBlocked && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Lien de modification</p>
              <p className="text-xs text-slate-500 mb-3">
                {registration.editTokenExpiresAt && new Date(registration.editTokenExpiresAt) > new Date()
                  ? `Expire le ${new Date(registration.editTokenExpiresAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
                  : "Expiré"}
              </p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/edit-registration/${registration.editToken}`);
                }}
                className="text-xs text-indigo-600 hover:text-indigo-700 underline"
              >
                Copier le lien
              </button>
            </div>
          )}

          {/* Blocage email (rejetée uniquement) */}
          {registration.status === "REJECTED" && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              {emailBlocked ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-rose-700 font-medium">Email bloqué</span>
                  <button
                    type="button"
                    onClick={unblockEmail}
                    className="text-xs text-indigo-600 hover:text-indigo-700 underline"
                  >
                    Débloquer
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmBlock(true)}
                  className="text-sm text-rose-600 hover:text-rose-700 underline"
                >
                  Bloquer cet email
                </button>
              )}
            </div>
          )}
        </div>
        )}

        {/* Colonne doublons */}
        {!duplicatesLoading && duplicates.length > 0 && (
          <div className="w-full lg:w-80 space-y-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-700 mb-3">
                Inscriptions similaires ({duplicates.length})
              </p>
              <div className="space-y-3">
                {duplicates.map((dup) => (
                  <Link
                    key={dup.id}
                    href={`/admin/registrations/${dup.id}`}
                    className="block border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-900">
                        {dup.firstName} {dup.lastName}
                      </span>
                      <StatusBadge status={dup.status as "PENDING" | "APPROVED" | "REJECTED"} />
                    </div>
                    <dl className="space-y-1 text-xs text-slate-500">
                      <div className="flex justify-between">
                        <dt>Email</dt>
                        <dd className="text-right truncate ml-2">{dup.email}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>N° document</dt>
                        <dd className="font-mono">{dup.idDocumentNumber}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Structure</dt>
                        <dd className="text-right truncate ml-2">{dup.structure}</dd>
                      </div>
                      <div className="flex justify-between items-center">
                        <dt>Équipe</dt>
                        <dd className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dup.team.color }} />
                          <span>{dup.team.name}</span>
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {dup.matchReasons.map((reason) => (
                        <span
                          key={reason}
                          className="inline-block text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de validation */}
      <Modal
        open={confirmAction === "APPROVED"}
        title="Confirmer la validation"
        confirmLabel="Valider"
        confirmVariant="primary"
        onConfirm={() => updateStatus("APPROVED")}
        onCancel={() => setConfirmAction(null)}
      >
        <p className="text-sm text-slate-600">
          Voulez-vous valider l&apos;inscription de {registration.firstName} {registration.lastName} ?
        </p>
      </Modal>

      {/* Modal de rejet avec motif */}
      <Modal
        open={confirmAction === "REJECTED"}
        title="Confirmer le rejet"
        confirmLabel="Rejeter"
        confirmVariant="danger"
        onConfirm={() => updateStatus("REJECTED")}
        onCancel={() => { setConfirmAction(null); setRejectionReason(""); setRejectionDetails(""); }}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Voulez-vous rejeter l&apos;inscription de {registration.firstName} {registration.lastName} ?
          </p>
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Attention : cette action est irréversible. Une inscription rejetée ne pourra plus être validée.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Motif du rejet</label>
            <select
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Sélectionner un motif...</option>
              {REJECTION_REASONS.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Détails (optionnel)</label>
            <textarea
              value={rejectionDetails}
              onChange={(e) => setRejectionDetails(e.target.value)}
              rows={3}
              placeholder="Précisions supplémentaires..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* Modal de confirmation d'envoi du lien de modification */}
      <Modal
        open={confirmEditLink}
        title="Envoyer un lien de modification"
        confirmLabel="Envoyer"
        confirmVariant="primary"
        onConfirm={async () => {
          setConfirmEditLink(false);
          await sendEditLink();
        }}
        onCancel={() => setConfirmEditLink(false)}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Voulez-vous envoyer un lien de modification à <strong>{registration.firstName} {registration.lastName}</strong> ({registration.email}) ?
          </p>
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            L&apos;inscrit recevra un email lui permettant de modifier son inscription. Une fois modifiée, l&apos;inscription repassera automatiquement en attente de validation.
          </p>
        </div>
      </Modal>

      {/* Modal de confirmation de blocage */}
      <Modal
        open={confirmBlock}
        title="Bloquer cet email"
        confirmLabel="Bloquer"
        confirmVariant="danger"
        onConfirm={blockEmail}
        onCancel={() => setConfirmBlock(false)}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Voulez-vous bloquer l&apos;adresse <strong>{registration?.email}</strong> ?
          </p>
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Cette adresse ne pourra plus soumettre ni modifier d&apos;inscription.
          </p>
        </div>
      </Modal>
    </div>
  );
}
