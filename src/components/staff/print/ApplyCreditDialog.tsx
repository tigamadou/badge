"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { toastSuccess } from "@/lib/toast";
import { formatFcfa } from "@/lib/print-requests/labels";
import { defaultCreditAmount } from "@/lib/print-requests/credit-view";
import { requestUrl, staffRequest } from "./request-fetch";

// Application du crédit d'impression de l'organisation à une commande (STAFF_ADMIN).
// Les refus (REQUEST_LOCKED, CREDIT_INSUFFICIENT, CREDIT_EXCEEDS_TOTAL) arrivent déjà en français.
export function ApplyCreditDialog({
  open,
  requestId,
  available,
  grossTotal,
  onClose,
  onApplied,
}: {
  open: boolean;
  requestId: string;
  available: number;
  grossTotal: number;
  onClose: () => void;
  onApplied: () => void;
}) {
  const max = defaultCreditAmount(available, grossTotal);
  const [amount, setAmount] = useState(String(max));
  const [busy, setBusy] = useState(false);
  const value = Number(amount);
  const valid = amount.trim() !== "" && Number.isInteger(value) && value >= 1 && value <= max;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    const res = await staffRequest(requestUrl(requestId, "/credit"), "POST", { amount: value });
    setBusy(false);
    if (!res) return;
    toastSuccess(`Crédit de ${formatFcfa(value)} appliqué.`);
    onClose();
    onApplied();
  }

  return (
    <Dialog
      open={open}
      title="Appliquer le crédit d'impression"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="button" loading={busy} disabled={!valid} onClick={() => void submit()}>
            Appliquer
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-500">
        {`Crédit disponible : ${formatFcfa(available)}. Montant maximal applicable à cette commande : ${formatFcfa(max)}.`}
      </p>
      <Input
        label="Montant (FCFA)"
        type="number"
        min={1}
        max={max}
        step={1}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
    </Dialog>
  );
}
