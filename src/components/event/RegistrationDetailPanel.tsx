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
import { FileBox } from "@/components/ui/FileBox";
import { Icon } from "@/components/ui/Icon";
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
            onChanged={() => router.refresh()}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Pièces fournies" />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {r.photo ? (
              <a href={`/api/files/${r.photo}`} target="_blank" rel="noreferrer">
                <FileBox icon="user" title="Photo" subtitle="Voir le fichier" action={<Icon name="external-link" size={16} />} />
              </a>
            ) : (
              <FileBox icon="user" title="Photo" subtitle="Non fournie" />
            )}
            {r.idDocument ? (
              <a href={`/api/files/${r.idDocument}`} target="_blank" rel="noreferrer">
                <FileBox icon="file" title="Pièce d'identité" subtitle="Voir le fichier" action={<Icon name="external-link" size={16} />} />
              </a>
            ) : (
              <FileBox icon="file" title="Pièce d'identité" subtitle="Non fournie" />
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
