"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Segmented } from "@/components/ui/Tabs";
import { TableFrame } from "@/components/ui/TableFrame";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { formatFcfa } from "@/lib/print-catalog/pricing-core";
import type { ProductListRow } from "@/lib/print-catalog/products";
import { toastSuccess } from "@/lib/toast";

const KIND_LABEL = { BADGE: "Support de badge", ACCESSORY: "Accessoire" } as const;

function StatusPill({ row }: { row: ProductListRow }) {
  const [label, cls] = row.archived
    ? ["Archivé", "bg-slate-100 text-slate-600"]
    : row.published
      ? ["Publié", "bg-emerald-50 text-emerald-700"]
      : ["Brouillon", "bg-amber-50 text-amber-700"];
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

export function CatalogList({
  rows,
  kind,
  archived,
  canWrite,
}: {
  rows: ProductListRow[];
  kind: "BADGE" | "ACCESSORY" | null;
  archived: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ kind: "BADGE", name: "", basePrice: "0" });

  function go(next: { kind?: string | null; archived?: boolean }) {
    const q = new URLSearchParams();
    const k = next.kind === undefined ? kind : next.kind;
    const a = next.archived === undefined ? archived : next.archived;
    if (k) q.set("kind", k);
    if (a) q.set("archived", "true");
    const qs = q.toString();
    router.push(`/platform/print/catalog${qs ? `?${qs}` : ""}`);
  }

  const price = Number(form.basePrice);
  const priceOk = form.basePrice.trim() !== "" && Number.isInteger(price) && price >= 0;
  const canCreate = form.name.trim() !== "" && priceOk;

  const create = useAsyncAction(
    async (): Promise<{ id: string }> => {
      const res = await fetch("/api/platform/print/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: form.kind, name: form.name.trim(), basePrice: price }),
      });
      if (!res.ok) throw res;
      const json = await res.json();
      return { id: json.product?.id ?? json.id };
    },
    {
      error: "Échec de la création du produit.",
      onSuccess: ({ id }) => {
        toastSuccess("Produit créé.");
        setCreating(false);
        router.push(`/platform/print/catalog/${id}`);
      },
    },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            value={kind ?? "ALL"}
            onChange={(v) => go({ kind: v === "ALL" ? null : v })}
            options={[
              { value: "ALL", label: "Tous" },
              { value: "BADGE", label: "Supports de badge" },
              { value: "ACCESSORY", label: "Accessoires" },
            ]}
          />
          <Segmented
            value={archived ? "ARCHIVED" : "ACTIVE"}
            onChange={(v) => go({ archived: v === "ARCHIVED" })}
            options={[
              { value: "ACTIVE", label: "Actifs" },
              { value: "ARCHIVED", label: "Archivés" },
            ]}
          />
        </div>
        {canWrite && (
          <Button
            type="button"
            onClick={() => {
              setForm({ kind: "BADGE", name: "", basePrice: "0" });
              setCreating(true);
            }}
          >
            Nouveau produit
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-400">
          Aucun produit dans le catalogue.
        </p>
      ) : (
        <TableFrame>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["", "Nom", "Catégorie", "À partir de", "Statut", "Options"].map((h, i) => (
                  <th
                    key={i}
                    className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => router.push(`/platform/print/catalog/${r.id}`)}
                  className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    {r.mainImageKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/files/${r.mainImageKey}`}
                        alt=""
                        className="h-10 w-10 rounded-md border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md border border-slate-200 bg-slate-50" />
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                  <td className="px-4 py-3 text-slate-600">{r.category ?? KIND_LABEL[r.kind]}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatFcfa(r.startingPrice)}</td>
                  <td className="px-4 py-3">
                    <StatusPill row={r} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.optionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableFrame>
      )}

      <Dialog
        open={creating}
        title="Nouveau produit"
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
              Annuler
            </Button>
            <Button type="button" disabled={!canCreate || create.pending} onClick={() => void create.run()}>
              Créer
            </Button>
          </>
        }
      >
        <Select
          label="Famille"
          value={form.kind}
          onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
          options={[
            { value: "BADGE", label: "Support de badge" },
            { value: "ACCESSORY", label: "Accessoire" },
          ]}
        />
        <Input label="Nom" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <Input
          label="Prix de base (FCFA)"
          type="number"
          min={0}
          step={1}
          value={form.basePrice}
          onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
        />
      </Dialog>
    </div>
  );
}
