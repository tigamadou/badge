"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHead } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { formatFcfa } from "@/lib/print-requests/labels";
import { toastError } from "@/lib/toast";
import { requestUrl, staffRequest } from "./request-fetch";
import { signedUnitPrice } from "./request-actions";
import type { DetailLine, ProductOption } from "./request-types";

type Kind = DetailLine["kind"];

const KIND_LABEL: Record<Kind, string> = {
  PRODUCT: "Produit",
  SERVICE: "Service",
  DISCOUNT: "Remise",
  CUSTOM: "Ligne libre",
};

const CELL = "w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

// Montant affiché : une remise est saisie en positif (le signe est géré par signedUnitPrice).
const shownPrice = (l: { kind: Kind; unitPrice: number }) => (l.kind === "DISCOUNT" ? Math.abs(l.unitPrice) : l.unitPrice);

function LineRow({
  line,
  requestId,
  onChanged,
}: {
  line: DetailLine;
  requestId: string;
  onChanged: () => void;
}) {
  const [label, setLabel] = useState(line.label);
  const [quantity, setQuantity] = useState(String(line.quantity));
  const [price, setPrice] = useState(String(shownPrice(line)));
  const [busy, setBusy] = useState(false);

  // Enregistre les seuls champs modifiés ; une saisie invalide rétablit la valeur du serveur.
  async function commit() {
    const patch: { label?: string; quantity?: number; unitPrice?: number } = {};
    if (label.trim() !== line.label) patch.label = label.trim();
    const q = Number(quantity);
    if (q !== line.quantity) patch.quantity = q;
    const p = Number(price);
    if (p !== shownPrice(line)) patch.unitPrice = signedUnitPrice(line.kind, p);
    if (Object.keys(patch).length === 0) return;
    if (
      (patch.label !== undefined && patch.label === "") ||
      (patch.quantity !== undefined && !Number.isInteger(patch.quantity)) ||
      (patch.unitPrice !== undefined && !Number.isInteger(patch.unitPrice))
    ) {
      toastError("Valeur invalide : l'intitulé est obligatoire, la quantité et le prix sont des nombres entiers.");
      setLabel(line.label);
      setQuantity(String(line.quantity));
      setPrice(String(shownPrice(line)));
      return;
    }
    setBusy(true);
    const res = await staffRequest(requestUrl(requestId, `/lines/${line.id}`), "PATCH", patch);
    setBusy(false);
    if (res) onChanged();
    else {
      setLabel(line.label);
      setQuantity(String(line.quantity));
      setPrice(String(shownPrice(line)));
    }
  }

  async function remove() {
    setBusy(true);
    const res = await staffRequest(requestUrl(requestId, `/lines/${line.id}`), "DELETE");
    setBusy(false);
    if (res) onChanged();
  }

  return (
    <tr className="border-b border-slate-100 align-top">
      <td className="hidden px-1.5 py-2 text-xs text-slate-500 2xl:table-cell">{KIND_LABEL[line.kind]}</td>
      <td className="min-w-[5rem] px-1.5 py-2">
        <input
          aria-label={`Intitulé de la ligne ${line.label}`}
          className={CELL}
          value={label}
          maxLength={200}
          disabled={busy}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => void commit()}
        />
      </td>
      <td className="w-14 px-1.5 py-2">
        <input
          aria-label={`Quantité de ${line.label}`}
          className={`${CELL} px-1 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`}
          type="number"
          min={1}
          value={quantity}
          disabled={busy}
          onChange={(e) => setQuantity(e.target.value)}
          onBlur={() => void commit()}
        />
      </td>
      <td className="w-24 px-1.5 py-2">
        <input
          aria-label={`Prix unitaire de ${line.label}`}
          className={`${CELL} px-1 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`}
          type="number"
          min={0}
          value={price}
          disabled={busy}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => void commit()}
        />
      </td>
      <td className="whitespace-nowrap px-1 py-2 text-right text-xs tabular-nums">{formatFcfa(line.lineTotal)}</td>
      <td className="px-0 py-2 text-right">
        <button
          type="button"
          aria-label={`Retirer la ligne ${line.label}`}
          disabled={busy}
          onClick={() => void remove()}
          className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
        >
          <Icon name="trash-2" size={16} />
        </button>
      </td>
    </tr>
  );
}

function AddLineForm({
  requestId,
  products,
  onChanged,
}: {
  requestId: string;
  products: ProductOption[];
  onChanged: () => void;
}) {
  const [kind, setKind] = useState<Kind>("SERVICE");
  const [productId, setProductId] = useState("");
  const [label, setLabel] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  function pickProduct(id: string) {
    setProductId(id);
    const product = products.find((p) => p.id === id);
    if (product) {
      setLabel(product.name);
      setPrice(String(product.basePrice));
    }
  }

  async function add() {
    const q = Number(quantity);
    const p = Number(price);
    if (!label.trim() || !Number.isInteger(q) || q < 1 || price === "" || !Number.isInteger(p)) {
      toastError("Renseignez un intitulé, une quantité entière et un prix entier.");
      return;
    }
    if (kind === "PRODUCT" && !productId) {
      toastError("Choisissez un produit.");
      return;
    }
    setBusy(true);
    const res = await staffRequest(requestUrl(requestId, "/lines"), "POST", {
      kind,
      ...(kind === "PRODUCT" ? { productId } : {}),
      label: label.trim(),
      quantity: q,
      unitPrice: signedUnitPrice(kind, p),
    });
    setBusy(false);
    if (!res) return;
    setLabel("");
    setPrice("");
    setQuantity("1");
    setProductId("");
    onChanged();
  }

  return (
    <div className="mt-4 space-y-2 rounded-lg border border-dashed border-slate-300 p-3">
      <p className="text-xs font-medium text-slate-500">Ajouter une ligne</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Type
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
          >
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        {kind === "PRODUCT" && (
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Produit
            <select
              value={productId}
              onChange={(e) => pickProduct(e.target.value)}
              className="max-w-[14rem] rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
            >
              <option value="">Choisir…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-slate-500">
          Intitulé
          <input
            className={CELL}
            value={label}
            maxLength={200}
            placeholder="Frais de livraison"
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <label className="flex w-20 flex-col gap-1 text-xs text-slate-500">
          Quantité
          <input className={CELL} type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <label className="flex w-28 flex-col gap-1 text-xs text-slate-500">
          {kind === "DISCOUNT" ? "Montant (FCFA)" : "Prix unitaire"}
          <input className={CELL} type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <Button type="button" variant="secondary" loading={busy} onClick={() => void add()}>
          Ajouter
        </Button>
      </div>
    </div>
  );
}

export function QuoteEditor({
  requestId,
  lines,
  canEdit,
  products,
  onChanged,
  bare = false,
}: {
  requestId: string;
  lines: DetailLine[];
  canEdit: boolean;
  products: ProductOption[];
  onChanged: () => void;
  // Sans Card : le devis est alors affiché dans une modale qui porte déjà son titre.
  bare?: boolean;
}) {
  const total = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const content = (
    <>
        {lines.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune ligne.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="hidden px-1.5 py-2 font-medium 2xl:table-cell">Type</th>
                  <th className="px-1.5 py-2 font-medium">Intitulé</th>
                  <th className="px-1.5 py-2 font-medium">Qté</th>
                  <th className="px-1.5 py-2 font-medium">Prix unitaire</th>
                  <th className="px-1.5 py-2 text-right font-medium">Total</th>
                  <th className="px-0 py-2" />
                </tr>
              </thead>
              <tbody>
                {canEdit
                  ? lines.map((l) => <LineRow key={`${l.id}:${l.label}:${l.quantity}:${l.unitPrice}`} line={l} requestId={requestId} onChanged={onChanged} />)
                  : lines.map((l) => (
                      <tr key={l.id} className="border-b border-slate-100">
                        <td className="hidden px-1.5 py-2 text-xs text-slate-500 2xl:table-cell">{KIND_LABEL[l.kind]}</td>
                        <td className="px-1.5 py-2">{l.label}</td>
                        <td className="px-1.5 py-2 tabular-nums">{l.quantity}</td>
                        <td className="whitespace-nowrap px-1.5 py-2 tabular-nums">{formatFcfa(l.unitPrice)}</td>
                        <td className="whitespace-nowrap px-1 py-2 text-right text-xs tabular-nums">{formatFcfa(l.lineTotal)}</td>
                        <td />
                      </tr>
                    ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="px-1.5 py-2 text-right text-sm font-medium text-slate-700">
                    Total
                  </td>
                  <td className="whitespace-nowrap px-1 py-2 text-right text-xs font-semibold tabular-nums">{formatFcfa(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {canEdit && <AddLineForm requestId={requestId} products={products} onChanged={onChanged} />}
    </>
  );
  if (bare) return <div>{content}</div>;
  return (
    <Card>
      <CardHead
        title="Devis"
        subtitle={canEdit ? "Modifiez une valeur puis quittez le champ pour l'enregistrer." : "Lecture seule dans cet état."}
      />
      <CardBody className="!px-3">{content}</CardBody>
    </Card>
  );
}
