"use client";

import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui/ActionButton";
import { ActionError } from "@/lib/toast";

// Archive / restaure un evenement depuis la liste de l'organisation.
// L'action exige `org.events.archive` : la page ne rend ce controle que dans ce cas
// (la route API garde de son cote).
export function EventArchiveActions({
  orgId,
  eventId,
  archived,
}: {
  orgId: string;
  eventId: string;
  archived: boolean;
}) {
  const router = useRouter();

  return (
    <ActionButton
      variant="link"
      className="text-slate-600"
      confirm={archived ? undefined : "Archiver cet événement ?"}
      action={async () => {
        const res = await fetch(
          `/api/org/${orgId}/events/${eventId}/${archived ? "restore" : "archive"}`,
          { method: "POST" },
        );
        if (res.status === 403) throw new ActionError("Action non autorisée.");
        if (!res.ok) throw res;
      }}
      success={archived ? "Événement restauré." : "Événement archivé."}
      error="Action impossible."
      onSuccess={() => router.refresh()}
    >
      {archived ? "Restaurer" : "Archiver"}
    </ActionButton>
  );
}
