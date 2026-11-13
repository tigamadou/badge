"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ActionButton } from "@/components/ui/ActionButton";
import { Button } from "@/components/ui/Button";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { KeyValue } from "@/components/ui/JournalBlocks";
import { CatPill, Tag } from "@/components/ui/Labels";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Feedback";
import { DocumentPreview } from "@/components/ui/DocumentPreview";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { RegistrationActions } from "./RegistrationActions";
import type { Permission } from "@/lib/permissions";

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
  permissions,
}: {
  orgId: string;
  eventId: string;
  registration: Reg;
  rejectionReasons: { id: string; label: string }[];
  permissions: Permission[];
}) {
  const can = (p: Permission) => permissions.includes(p);
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);
  const r = registration;
  const base = `/api/org/${orgId}/events/${eventId}/registrations/${r.id}`;

  async function post(path: string, body: unknown) {
    const res = await fetch(`${base}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw res;
  }

  // Motif D : le toast survit à la navigation vers la liste.
  const remove = useAsyncAction(
    async () => {
      const res = await fetch(base, { method: "DELETE" });
      if (!res.ok) throw res;
    },
    {
      success: "Inscription supprimée.",
      error: "Échec de la suppression.",
      onSuccess: () => {
        setNavigating(true);
        router.push(`/event/${eventId}/registrations`);
      },
    },
  );

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
              {
                label: "Identité",
                value:
                  r.profileStatus === "APPROVED"
                    ? r.profileReviewedAt
                      ? `Vérifiée par la plateforme le ${new Date(r.profileReviewedAt).toLocaleDateString("fr-FR")}`
                      : "Vérifiée par la plateforme"
                    : r.profileStatus === "REJECTED"
                      ? "Refusée par la plateforme"
                      : "En attente de vérification par la plateforme",
              },
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
            badgePrinted={r.badgePrinted}
            profileApproved={r.profileStatus === "APPROVED"}
            reasons={rejectionReasons}
            permissions={permissions}
            onChanged={() => router.refresh()}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHead title={r.idDocumentReadable ? "Pièces fournies" : "Photo"} />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DocumentPreview storageKey={r.photo} label="Photo" />
            {/* La piece d'identite n'est servie qu'au staff plateforme (cf. canRead()
                dans /api/files) : pour l'organisation, ne rien afficher plutot qu'un
                encart qui se lit comme un fichier consultable. */}
            {r.idDocumentReadable && (
              <DocumentPreview storageKey={r.idDocument} label="Pièce d'identité" readable />
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Actions avancées" />
        <CardBody>
          <div className="flex flex-wrap gap-2">
{can("registration.all_access") && (
            <ActionButton
              variant="secondary"
              disabled={navigating}
              action={() => post("all-access", { allAccessGranted: !r.allAccessGranted })}
              success={r.allAccessGranted ? "Accès ALL ACCESS retiré." : "Accès ALL ACCESS accordé."}
              error="Échec de la modification de l'accès."
              onSuccess={() => router.refresh()}
            >
              {r.allAccessGranted ? "Retirer ALL ACCESS" : "Activer ALL ACCESS"}
            </ActionButton>
)}
{can("badge.print") && (
            <Link href={`/event/${eventId}/badges/${r.id}`}>
              <Button variant="secondary">Voir le badge</Button>
            </Link>
)}
{can("registration.block") && (
            <ActionButton
              variant="secondary"
              disabled={navigating}
              confirm={`Bloquer l'email ${r.email} sur cet événement ?`}
              action={() => post("block-email", { reason: "Bloqué via le détail inscription" })}
              success="E-mail bloqué."
              error="Échec du blocage de l'e-mail."
            >
              Bloquer cet e-mail
            </ActionButton>
)}
{can("registration.block") && (
            <ActionButton
              variant="secondary"
              disabled={navigating}
              confirm={`Bloquer le document ${r.idDocumentNumber} ?`}
              action={() => post("block-document", { reason: "Bloqué via le détail inscription" })}
              success="Document bloqué."
              error="Échec du blocage du document."
            >
              Bloquer ce document
            </ActionButton>
)}
{can("registration.delete") && (
            <Button
              variant="danger"
              loading={remove.pending || navigating}
              onClick={() => {
                if (!confirm(`Supprimer définitivement l'inscription de ${r.firstName} ${r.lastName} ?`)) return;
                void remove.run();
              }}
            >
              Supprimer
            </Button>
)}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
