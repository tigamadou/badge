"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { ActionError } from "@/lib/toast";
import { PRODUCTS_API, parseInt0, sendJson, VALIDATION_MESSAGE } from "./catalog-api";

type Row = { minQuantity: string; unitPrice: string };

const field = "w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy";

export function ProductTiersEditor({
  productId,
  tiers,
  disabled,
  onSaved,
}: {
  productId: string;
  tiers: { minQuantity: number; unitPrice: number }[];
  disabled: boolean;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(
    tiers.map((t) => ({ minQuantity: String(t.minQuantity), unitPrice: String(t.unitPrice) })),
  );

  const save = useAsyncAction(
    async () => {
      const payload = rows.map((r) => ({ minQuantity: parseInt0(r.minQuantity), unitPrice: parseInt0(r.unitPrice) }));
      if (payload.some((t) => t.minQuantity === null || t.minQuantity < 2 || t.unitPrice === null)) {
        throw new ActionError("Chaque palier exige une quantité d'au moins 2 et un prix en entier.");
      }
      const qs = payload.map((t) => t.minQuantity);
      if (new Set(qs).size !== qs.length) throw new ActionError("Deux paliers ne peuvent pas avoir la même quantité.");
      await sendJson(`${PRODUCTS_API}/${productId}/tiers`, "PUT", { tiers: payload });
    },
    { success: "Tarifs enregistrés.", error: VALIDATION_MESSAGE, onSuccess: onSaved },
  );

  const set = (i: number, patch: Partial<Row>) =>
    setRows((list) => list.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Prix unitaire dégressif selon la quantité commandée.</p>
      {rows.length === 0 ? <p className="text-sm text-slate-400">{"Aucun palier : le prix de base s'applique."}</p> : null}
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
            <span>À partir de</span>
            <input
              aria-label={`Quantité minimale du palier ${i + 1}`}
              type="number"
              min={2}
              step={1}
              className={field}
              value={r.minQuantity}
              disabled={disabled}
              onChange={(e) => set(i, { minQuantity: e.target.value })}
            />
            <span>unités :</span>
            <input
              aria-label={`Prix unitaire du palier ${i + 1}`}
              type="number"
              min={0}
              step={1}
              className={field}
              value={r.unitPrice}
              disabled={disabled}
              onChange={(e) => set(i, { unitPrice: e.target.value })}
            />
            <span>FCFA</span>
            {disabled ? null : (
              <Button type="button" variant="secondary" onClick={() => setRows((l) => l.filter((_, k) => k !== i))}>
                Retirer
              </Button>
            )}
          </li>
        ))}
      </ul>
      {disabled ? null : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setRows((l) => [...l, { minQuantity: "", unitPrice: "" }])}>
            Ajouter un palier
          </Button>
          <Button type="button" disabled={save.pending} onClick={() => void save.run()}>
            Enregistrer les tarifs
          </Button>
        </div>
      )}
    </div>
  );
}
