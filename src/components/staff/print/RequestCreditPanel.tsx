"use client";

import { useState } from "react";
import type { PrintRequestStatus, StaffRole } from "@prisma/client";
import { OrgPrintCreditCard } from "@/components/print/OrgPrintCreditCard";
import { Alert } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { formatFcfa } from "@/lib/print-requests/labels";
import {
  canApplyCredit,
  creditWarning,
  showsCreditOffer,
  type CreditMovementView,
} from "@/lib/print-requests/credit-view";
import { ApplyCreditDialog } from "./ApplyCreditDialog";

export type StaffCreditData = {
  /** Solde de l'organisation (somme des mouvements). */
  balance: number;
  /** Crédit libre, hors la réservation de cette demande. */
  available: number;
  /** Crédit appliqué à cette demande (0 sans ligne de crédit). */
  applied: number;
  /** Total des lignes de la demande hors ligne de crédit. */
  grossTotal: number;
  movements: CreditMovementView[];
};

// Crédit d'impression côté staff : disponible, application, avertissement et mouvements.
export function RequestCreditPanel({
  requestId,
  status,
  role,
  credit,
  onChanged,
}: {
  requestId: string;
  status: PrintRequestStatus;
  role: StaffRole;
  credit: StaffCreditData;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const offer = showsCreditOffer(status, credit.available);
  const warning = creditWarning(credit.applied, credit.grossTotal);
  return (
    <div className="space-y-3">
      {offer || credit.applied > 0 ? (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4" data-testid="request-credit">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5 text-sm text-slate-800">
              <p>{`Crédit disponible de l'organisation : ${formatFcfa(credit.available)}`}</p>
              {credit.applied > 0 ? (
                <p className="text-slate-500">{`Crédit appliqué à cette demande : ${formatFcfa(credit.applied)}`}</p>
              ) : null}
            </div>
            {canApplyCredit(status, role, credit.available, credit.grossTotal) ? (
              <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
                {credit.applied > 0 ? "Modifier le crédit" : "Appliquer le crédit"}
              </Button>
            ) : null}
          </div>
          {warning ? <Alert tone="warn">{warning}</Alert> : null}
        </div>
      ) : null}
      <OrgPrintCreditCard balance={credit.balance} movements={credit.movements} />
      {/* Remonté à chaque ouverture : le montant pré-rempli suit le crédit disponible du moment. */}
      {open ? (
        <ApplyCreditDialog
          open
          requestId={requestId}
          available={credit.available}
          grossTotal={credit.grossTotal}
          onClose={() => setOpen(false)}
          onApplied={onChanged}
        />
      ) : null}
    </div>
  );
}
