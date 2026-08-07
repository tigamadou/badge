"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { KeyValue } from "@/components/ui/JournalBlocks";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Feedback";
import { DocumentPreview } from "@/components/ui/DocumentPreview";

type ProfileStatus = "INCOMPLETE" | "PENDING" | "APPROVED" | "REJECTED";

type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  structure: string | null;
  profileStatus: ProfileStatus;
  photo: string | null;
  idDocument: string | null;
  idDocumentType: string | null;
  idDocumentNumber: string | null;
};

type Submission = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReasonLabel: string | null;
  rejectionDetails: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

type Reason = { id: string; label: string };

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR");
}

export function ProfileReviewPanel({ user, submissions }: { user: User; submissions: Submission[] }) {
  const router = useRouter();
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [rejecting, setRejecting] = useState(false);
  const [reasonId, setReasonId] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPending = submissions[0]?.status === "PENDING";

  useEffect(() => {
    fetch("/api/platform/rejection-reasons?scope=PROFILE")
      .then((r) => (r.ok ? r.json() : { reasons: [] }))
      .then((d: { reasons: Reason[] }) => setReasons(d.reasons))
      .catch(() => setReasons([]));
  }, []);

  async function approve() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/platform/profiles/${user.id}/approve`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error === "NO_PENDING_SUBMISSION" ? "Aucune soumission en attente." : "Échec de l'approbation.");
    }
  }

  async function reject() {
    if (!reasonId) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/platform/profiles/${user.id}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reasonId, details: details || undefined }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(
        d.error === "REASON_WRONG_SCOPE"
          ? "Ce motif ne s'applique pas à un profil."
          : d.error === "NO_PENDING_SUBMISSION"
            ? "Aucune soumission en attente."
            : "Échec du rejet.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHead
          title={
            <span className="flex flex-wrap items-center gap-3">
              {user.firstName} {user.lastName}
              <StatusBadge status={(user.profileStatus === "INCOMPLETE" ? "PENDING" : user.profileStatus) as "PENDING" | "APPROVED" | "REJECTED"} />
            </span>
          }
          subtitle={`${user.email}${user.structure ? ` — ${user.structure}` : ""}`}
        />
        <CardBody className="space-y-4">
          {error && <Alert tone="err">{error}</Alert>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DocumentPreview storageKey={user.photo} label="Photo" />
            <DocumentPreview storageKey={user.idDocument} label="Pièce d'identité" />
          </div>
          <KeyValue
            items={[
              { label: "Type de pièce", value: user.idDocumentType ?? "—" },
              { label: "Numéro de pièce", value: user.idDocumentNumber ?? "—" },
            ]}
          />

          {currentPending && (
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap gap-2">
                <Button onClick={approve} disabled={busy}>
                  Approuver
                </Button>
                <Button variant="secondary" onClick={() => setRejecting((v) => !v)} disabled={busy}>
                  Rejeter
                </Button>
              </div>
              {rejecting && (
                <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="reject-reason">
                    Motif de rejet
                  </label>
                  <select
                    id="reject-reason"
                    value={reasonId}
                    onChange={(e) => setReasonId(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Sélectionner un motif…</option>
                    {reasons.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={3}
                    placeholder="Détails (optionnel)"
                    className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <Button variant="danger" onClick={reject} disabled={busy || !reasonId}>
                    Confirmer le rejet
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Historique des soumissions" />
        <CardBody className="!py-0 divide-y divide-slate-100">
          {submissions.length === 0 ? (
            <p className="py-4 text-sm text-slate-400">Aucune soumission.</p>
          ) : (
            submissions.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="flex items-center gap-3">
                  <StatusBadge status={s.status} />
                  {s.rejectionReasonLabel && (
                    <span className="text-slate-600">
                      {s.rejectionReasonLabel}
                      {s.rejectionDetails ? ` — ${s.rejectionDetails}` : ""}
                    </span>
                  )}
                </span>
                <span className="text-xs tabular-nums text-slate-400">
                  Soumis le {fmt(s.createdAt)}
                  {s.reviewedAt ? ` · décidé le ${fmt(s.reviewedAt)}` : ""}
                </span>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
