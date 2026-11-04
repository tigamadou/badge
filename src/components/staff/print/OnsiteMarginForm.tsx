"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toastSuccess } from "@/lib/toast";
import type { OnsiteCounter } from "@/lib/print-requests/onsite-counter";
import { requestUrl, staffRequest } from "./request-fetch";

// Réglage de la marge de l'impression sur place (STAFF_ADMIN) : un motif est obligatoire.
export function OnsiteMarginForm({
  requestId,
  counter,
  onChanged,
}: {
  requestId: string;
  counter: OnsiteCounter;
  onChanged: (counter: OnsiteCounter) => void;
}) {
  const [margin, setMargin] = useState(String(counter.marginPercent));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const value = Number(margin);
  const valid = margin.trim() !== "" && Number.isInteger(value) && value >= 0 && value <= 100 && reason.trim().length >= 3;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    const res = await staffRequest(requestUrl(requestId, "/onsite/margin"), "PATCH", {
      marginPercent: value,
      reason: reason.trim(),
    });
    setBusy(false);
    if (!res) return;
    const { counter: next } = (await res.json()) as { counter: OnsiteCounter };
    setReason("");
    setMargin(String(next.marginPercent));
    toastSuccess("Marge mise à jour");
    onChanged(next);
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-navy">Marge d&apos;impression</h3>
      <div className="grid gap-3 sm:grid-cols-[120px_1fr_auto] sm:items-end">
        <Input
          label="Marge (%)"
          type="number"
          min={0}
          max={100}
          step={1}
          value={margin}
          onChange={(e) => setMargin(e.target.value)}
        />
        <Input label="Motif" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        <div className="mb-4">
          <Button type="submit" loading={busy} disabled={!valid}>
            Enregistrer
          </Button>
        </div>
      </div>
    </form>
  );
}
