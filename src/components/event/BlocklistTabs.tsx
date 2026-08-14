"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { Tag } from "@/components/ui/Labels";
import { BlockedEmailsForm } from "./BlockedEmailsForm";
import { BlockedDocumentsForm } from "./BlockedDocumentsForm";

type EmailRow = { id: string; email: string; reason: string | null; createdAt: string };
type DocRow = { id: string; documentNumber: string; reason: string | null; createdAt: string };

// Fusion UI (v2-16) : les deux listes de blocage (e-mails / documents) partagent
// un ecran a onglets. Les API et les formulaires restent inchanges.
export function BlocklistTabs({
  orgId,
  eventId,
  emails,
  documents,
}: {
  orgId: string;
  eventId: string;
  emails: EmailRow[];
  documents: DocRow[];
}) {
  const [tab, setTab] = useState<"emails" | "documents">("emails");

  return (
    <div>
      <Tabs
        value={tab}
        onChange={(v) => setTab(v as "emails" | "documents")}
        tabs={[
          {
            value: "emails",
            label: (
              <span className="inline-flex items-center gap-2">
                E-mails <Tag>{emails.length}</Tag>
              </span>
            ),
          },
          {
            value: "documents",
            label: (
              <span className="inline-flex items-center gap-2">
                Documents <Tag>{documents.length}</Tag>
              </span>
            ),
          },
        ]}
      />
      {tab === "emails" ? (
        <BlockedEmailsForm orgId={orgId} eventId={eventId} initial={emails} />
      ) : (
        <BlockedDocumentsForm orgId={orgId} eventId={eventId} initial={documents} />
      )}
    </div>
  );
}
