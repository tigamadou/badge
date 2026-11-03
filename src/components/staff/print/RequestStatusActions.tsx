"use client";

import Link from "next/link";
import { useState } from "react";
import type { PrintRequestStatus, PrintRequestType, StaffRole } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { toastError, toastSuccess } from "@/lib/toast";
import { chunk } from "@/lib/print-requests/labels";
import { MARK_PRINTED_CHUNK } from "@/lib/badge-batch";
import { availableActions, canGenerateSheets, unprintedIds, type StaffAction } from "./request-actions";
import { requestUrl, staffRequest } from "./request-fetch";

const LABEL: Record<StaffAction, string> = {
  SEND_QUOTE: "Envoyer le devis",
  REJECT: "Refuser",
  REOPEN: "Rouvrir le devis",
  MARK_PAID: "Marquer payée",
  START_PRODUCTION: "Passer en production",
  MARK_READY: "Marquer prête",
  COMPLETE: "Terminer",
};

// Bornes des motifs, les mêmes que côté serveur (rejectRequest : 3 à 1000 ; markPaidManually : 3 à 500).
const REASON_MIN = 3;
const REASON_MAX = { REJECT: 1000, MARK_PAID: 500 } as const;

const MARK_PAID_ERRORS = { PAYMENT_IN_PROGRESS: "Un paiement FedaPay est en cours sur cette demande." };

const TEXTAREA =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

export function RequestStatusActions({
  request,
  eventId,
  orgId,
  items,
  role,
  onChanged,
}: {
  request: { id: string; status: PrintRequestStatus; type: PrintRequestType };
  eventId: string;
  orgId: string;
  items: { registrationId: string; badgePrinted: boolean }[];
  role: StaffRole;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<StaffAction | null>(null);
  const [dialog, setDialog] = useState<"REJECT" | "MARK_PAID" | "COMPLETE" | null>(null);
  const [reason, setReason] = useState("");
  const actions = availableActions(request.status, role);
  const showSheets = canGenerateSheets(request.status, request.type, role);
  const toPrint = request.type === "ADVANCE" ? unprintedIds(items) : [];

  function close() {
    setDialog(null);
    setReason("");
  }

  async function run(
    action: StaffAction,
    path: string,
    body?: unknown,
    success?: string,
    codeMessages?: Record<string, string>,
  ): Promise<boolean> {
    setBusy(action);
    const res = await staffRequest(requestUrl(request.id, path), "POST", body, codeMessages);
    setBusy(null);
    if (!res) return false;
    if (success) toastSuccess(success);
    onChanged();
    return true;
  }

  // Ruling C17 : la demande passe d'abord en COMPLETED, puis le marquage est tenté ; son échec
  // (évènement archivé, droits) n'annule pas la clôture et prévient seulement.
  async function complete(markPrinted: boolean) {
    close();
    if (!(await run("COMPLETE", "/status", { to: "COMPLETED" }, "Demande terminée."))) return;
    if (!markPrinted || toPrint.length === 0) return;
    for (const ids of chunk(toPrint, MARK_PRINTED_CHUNK)) {
      const ok = await staffRequest(`/api/org/${orgId}/events/${eventId}/registrations/print`, "POST", { ids });
      if (!ok) {
        toastError("La demande est terminée, mais les badges n'ont pas pu être marqués comme imprimés.");
        return;
      }
    }
    toastSuccess("Badges marqués comme imprimés.");
    onChanged();
  }

  function onClick(action: StaffAction) {
    if (action === "SEND_QUOTE") void run(action, "/send-quote", undefined, "Devis envoyé.");
    else if (action === "REOPEN") void run(action, "/reopen", undefined, "Devis rouvert.");
    else if (action === "START_PRODUCTION") void run(action, "/status", { to: "IN_PRODUCTION" });
    else if (action === "MARK_READY") void run(action, "/status", { to: "READY" });
    else if (action === "COMPLETE") {
      if (toPrint.length > 0) setDialog("COMPLETE");
      else void complete(false);
    } else setDialog(action);
  }

  async function submitReason() {
    const text = reason.trim();
    if (dialog === "REJECT") {
      if (text.length < REASON_MIN) return;
      if (await run("REJECT", "/reject", { reason: text }, "Demande refusée.")) close();
    } else if (dialog === "MARK_PAID") {
      if (text.length < REASON_MIN) return;
      if (await run("MARK_PAID", "/mark-paid", { reason: text }, "Demande marquée payée.", MARK_PAID_ERRORS)) close();
    }
  }

  if (actions.length === 0 && !showSheets) return null;

  const reasonDialog = dialog === "REJECT" || dialog === "MARK_PAID";
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((a) => (
          <Button
            key={a}
            type="button"
            variant={a === "REJECT" ? "danger" : a === "SEND_QUOTE" || a === "MARK_PAID" ? "primary" : "secondary"}
            loading={busy === a}
            disabled={busy !== null}
            onClick={() => onClick(a)}
          >
            {LABEL[a]}
          </Button>
        ))}
        {showSheets && (
          <Link
            href={`/platform/print/sheets?printRequestId=${request.id}`}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Générer les planches
          </Link>
        )}
      </div>

      <Dialog
        open={reasonDialog}
        title={dialog === "REJECT" ? "Refuser la demande" : "Marquer la demande payée"}
        onClose={close}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={close}>
              Annuler
            </Button>
            <Button
              type="button"
              variant={dialog === "REJECT" ? "danger" : "primary"}
              loading={busy === dialog}
              disabled={reason.trim().length < REASON_MIN}
              onClick={() => void submitReason()}
            >
              {dialog === "REJECT" ? "Refuser" : "Marquer payée"}
            </Button>
          </>
        }
      >
        {dialog === "MARK_PAID" && (
          <p className="mb-3 text-sm text-slate-500">
            À utiliser pour un paiement reçu hors FedaPay (virement, espèces).
          </p>
        )}
        <label className="block text-sm font-medium text-slate-700" htmlFor="print-request-reason">
          {dialog === "REJECT"
            ? "Motif du refus (transmis à l'organisateur, 3 caractères minimum)"
            : "Motif du paiement manuel (3 caractères minimum)"}
        </label>
        <textarea
          id="print-request-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          maxLength={dialog === "REJECT" ? REASON_MAX.REJECT : REASON_MAX.MARK_PAID}
          className={`mt-1 ${TEXTAREA}`}
        />
      </Dialog>

      <Dialog
        open={dialog === "COMPLETE"}
        title={`Marquer les ${toPrint.length} badges comme imprimés ?`}
        onClose={close}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => void complete(false)}>
              Non
            </Button>
            <Button type="button" onClick={() => void complete(true)}>
              Oui
            </Button>
          </>
        }
      >
        <p>
          La demande est d&apos;abord terminée, puis les badges sont marqués comme imprimés. « Oui » marque ces badges (les
          participants sont prévenus) ; si le marquage échoue, la demande reste terminée. « Non » termine seulement la
          demande.
        </p>
      </Dialog>
    </>
  );
}
