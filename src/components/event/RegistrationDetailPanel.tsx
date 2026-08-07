"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { KeyValue } from "@/components/ui/JournalBlocks";
import { CatPill, Tag } from "@/components/ui/Labels";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Feedback";
import { DocumentPreview } from "@/components/ui/DocumentPreview";
import { FileBox } from "@/components/ui/FileBox";
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
  idDocumentReadable: boolean;
  profileStatus: "INCOMPLETE" | "PENDING" | "APPROVED" | "REJECTED";
  profileReviewedAt: string | null;
  idDocumentType: string;
  idDocumentNumber: string;
  createdAt: string;
  category: { id: string; name: string; color: string; number: number };
};

export function RegistrationDetailPanel({
  orgId,
  eventId,
  registration,
  rejectionReasons,
}: {
  orgId: string;
  eventId: string;
  registration: Reg;
  rejectionReasons: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const r = registration;

  async function blockEmail() {
    if (!confirm(`Bloquer l'email ${r.email} sur cet événement ?`)) return;
    await fetch(`/api/org/${orgId}/events/${eventId}/registrations/${r.id}/block-email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Bloqué via le détail inscription" }),
    });
    alert("Email bloqué.");
  }

  async function blockDocument() {
    if (!confirm(`Bloquer le document ${r.idDocumentNumber} ?`)) return;
    await fetch(`/api/org/${orgId}/events/${eventId}/registrations/${r.id}/block-document`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Bloqué via le détail inscription" }),
    });
    alert("Document bloqué.");
  }

  async function toggleAllAccess() {
    await fetch(`/api/org/${orgId}/events/${eventId}/registrations/${r.id}/all-access`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ allAccessGranted: !r.allAccessGranted }),
    });
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Supprimer définitivement l'inscription de ${r.firstName} ${r.lastName} ?`)) return;
    setBusy(true);
    await fetch(`/api/org/${orgId}/events/${eventId}/registrations/${r.id}`, { method: "DELETE" });
    router.push(`/event/${eventId}/registrations`);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHead
          title={
            <span className="flex flex-wrap items-center gap-3">
              {r.firstName} {r.lastName}
              <StatusBadge status={r.status} />
              {r.allAccessGranted && <Tag icon="check">ALL ACCESS</Tag>}
            </span>
          }
          subtitle={`${r.email} — ${r.structure}`}
        />
        <CardBody className="space-y-4">
          {r.rejectionReason && (
            <Alert tone="err">
              <div>
                <p className="font-semibold">Motif de rejet : {r.rejectionReason}</p>
                {r.rejectionDetails && <p className="mt-1 text-[13px]">{r.rejectionDetails}</p>}
              </div>
            </Alert>
          )}
          <KeyValue
            items={[
              {
                label: "Catégorie",
                value: <CatPill color={r.category.color} label={`${r.category.name} (#${r.category.number})`} />,
              },
              { label: "Pièce", value: `${r.idDocumentType} ${r.idDocumentNumber}` },
              { label: "Inscrit le", value: new Date(r.createdAt).toLocaleString("fr-FR") },
              ...(r.badgePrinted && r.badgePrintedAt
                ? [{ label: "Badge imprimé le", value: new Date(r.badgePrintedAt).toLocaleString("fr-FR") }]
                : []),
            ]}
          />
          <RegistrationActions
            orgId={orgId}
            eventId={eventId}
            registrationId={r.id}
            status={r.status}
            profileApproved={r.profileStatus === "APPROVED"}
            reasons={rejectionReasons}
            onChanged={() => router.refresh()}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Pièces fournies" />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DocumentPreview storageKey={r.photo} label="Photo" />
            {r.idDocumentReadable ? (
              <DocumentPreview storageKey={r.idDocument} label="Pièce d'identité" readable />
            ) : (
              <FileBox
                icon="shield"
                title="Pièce d'identité"
                subtitle={
                  r.profileStatus === "APPROVED"
                    ? r.profileReviewedAt
                      ? `Vérifiée par la plateforme le ${new Date(r.profileReviewedAt).toLocaleDateString("fr-FR")}`
                      : "Vérifiée par la plateforme"
                    : r.profileStatus === "REJECTED"
                      ? "Refusée par la plateforme"
                      : "En attente de vérification par la plateforme"
                }
              />
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Actions avancées" />
        <CardBody>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={toggleAllAccess} disabled={busy}>
              {r.allAccessGranted ? "Retirer ALL ACCESS" : "Activer ALL ACCESS"}
            </Button>
            <Link href={`/event/${eventId}/badges/${r.id}`}>
              <Button variant="secondary">Voir le badge</Button>
            </Link>
            <Button variant="secondary" onClick={blockEmail} disabled={busy}>
              Bloquer cet e-mail
            </Button>
            <Button variant="secondary" onClick={blockDocument} disabled={busy}>
              Bloquer ce document
            </Button>
            <Button variant="danger" onClick={remove} disabled={busy}>
              Supprimer
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
