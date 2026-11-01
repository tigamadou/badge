"use client";

import { Button } from "@/components/ui/Button";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { toastError } from "@/lib/toast";
import { NOT_OWNER_MESSAGE, PENDING_NOTICE, payButtonLabel, payErrorMessage } from "./pay-button";

// Paiement du devis accepté : ouvre la page de paiement FedaPay (OWNER hors mode staff).
export function PrintPayButton({
  orgId,
  eventId,
  requestId,
  amount,
  canPay,
  pending,
}: {
  orgId: string;
  eventId: string;
  requestId: string;
  amount: number;
  canPay: boolean;
  pending: boolean;
}) {
  const { run, pending: starting } = useAsyncAction(
    async () => {
      const res = await fetch(`/api/org/${orgId}/events/${eventId}/print-requests/${requestId}/checkout`, {
        method: "POST",
      });
      if (!res.ok) {
        const code = await res
          .json()
          .then((b: { error?: unknown }) => (typeof b.error === "string" ? b.error : null))
          .catch(() => null);
        toastError(payErrorMessage(code));
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.location.assign(url);
    },
    { error: payErrorMessage(null) },
  );

  if (!canPay) return <p className="text-sm text-slate-500">{NOT_OWNER_MESSAGE}</p>;
  return (
    <div className="space-y-2">
      {pending ? <p className="text-sm text-slate-500">{PENDING_NOTICE}</p> : null}
      <Button type="button" loading={starting} onClick={() => void run()}>
        {payButtonLabel(amount)}
      </Button>
    </div>
  );
}
