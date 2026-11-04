"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui/Tabs";
import { Tag } from "@/components/ui/Labels";
import { BlockedEmailsForm } from "./BlockedEmailsForm";
import { BlockedDocumentsForm } from "./BlockedDocumentsForm";

type EmailRow = { id: string; email: string; reason: string | null; createdAt: string };
type DocRow = { id: string; documentNumber: string; reason: string | null; createdAt: string };
export type BlocklistTab = "emails" | "documents";

// Fusion UI (v2-16) : les deux listes de blocage (e-mails / documents) partagent
// un ecran a onglets. L'onglet actif vit dans l'URL (`tab`) ; la page serveur ne lit et ne
// pagine que la liste de cet onglet et fournit les deux totaux pour les pastilles.
export function BlocklistTabs({
  orgId,
  eventId,
  tab,
  emails,
  documents,
  emailTotal,
  documentTotal,
  footer,
}: {
  orgId: string;
  eventId: string;
  tab: BlocklistTab;
  emails: EmailRow[];
  documents: DocRow[];
  emailTotal: number;
  documentTotal: number;
  footer?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Changer d'onglet retire `page` (chaque liste a sa propre pagination).
  function changeTab(next: BlocklistTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (next === "emails") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div>
      <Tabs
        value={tab}
        onChange={(v) => changeTab(v as BlocklistTab)}
        tabs={[
          {
            value: "emails",
            label: (
              <span className="inline-flex items-center gap-2">
                E-mails <Tag>{emailTotal}</Tag>
              </span>
            ),
          },
          {
            value: "documents",
            label: (
              <span className="inline-flex items-center gap-2">
                Documents <Tag>{documentTotal}</Tag>
              </span>
            ),
          },
        ]}
      />
      {tab === "emails" ? (
        <BlockedEmailsForm orgId={orgId} eventId={eventId} rows={emails} footer={footer} />
      ) : (
        <BlockedDocumentsForm orgId={orgId} eventId={eventId} rows={documents} footer={footer} />
      )}
    </div>
  );
}
