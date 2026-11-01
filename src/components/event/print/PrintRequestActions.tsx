"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { toastSuccess } from "@/lib/toast";

const EDITABLE = ["DRAFT", "SUBMITTED", "QUOTED"];
const CANCELLABLE = ["DRAFT", "SUBMITTED", "QUOTED", "ACCEPTED"];

// Actions de l'organisateur sur une demande. Le bouton « Payer » est rendu par la page (PrintPayButton).
export function PrintRequestActions({
  orgId,
  eventId,
  requestId,
  status,
  quoteVersion,
  canAccept,
  archived,
  readOnly,
}: {
  orgId: string;
  eventId: string;
  requestId: string;
  status: string;
  quoteVersion: number;
  canAccept: boolean;
  archived: boolean;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const base = `/api/org/${orgId}/events/${eventId}/print-requests/${requestId}`;

  async function post(path: string, body?: unknown) {
    const res = await fetch(`${base}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw res;
  }

  const { run: accept, pending: accepting } = useAsyncAction(() => post("accept", { version: quoteVersion }), {
    onSuccess: () => {
      toastSuccess("Devis accepté.");
      router.refresh();
    },
  });
  const { run: cancel, pending: cancelling } = useAsyncAction(() => post("cancel"), {
    onSuccess: () => {
      setConfirming(false);
      toastSuccess("Demande annulée.");
      router.refresh();
    },
  });

  if (readOnly) return null;
  const canEdit = EDITABLE.includes(status) && !archived;
  const canCancel = CANCELLABLE.includes(status);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {canEdit ? (
          <Link
            href={`/event/${eventId}/print/${requestId}/edit`}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
          >
            Modifier
          </Link>
        ) : null}
        {status === "QUOTED" && canAccept ? (
          <Button type="button" loading={accepting} onClick={() => void accept()}>
            {`Accepter le devis v${quoteVersion}`}
          </Button>
        ) : null}
        {canCancel ? (
          <Button type="button" variant="danger" onClick={() => setConfirming(true)}>
            Annuler la demande
          </Button>
        ) : null}
      </div>
      {status === "QUOTED" && !canAccept ? (
        <p className="text-sm text-slate-500">Seul le propriétaire de l&apos;organisation peut accepter ce devis.</p>
      ) : null}
      <Dialog
        open={confirming}
        title="Annuler la demande"
        onClose={() => setConfirming(false)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
              Garder la demande
            </Button>
            <Button type="button" variant="danger" loading={cancelling} onClick={() => void cancel()}>
              Annuler la demande
            </Button>
          </>
        }
      >
        Voulez-vous vraiment annuler cette demande d&apos;impression ? Les badges réservés seront libérés.
      </Dialog>
    </div>
  );
}
