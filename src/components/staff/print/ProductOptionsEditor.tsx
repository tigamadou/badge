"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/FormControls";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { ActionError } from "@/lib/toast";
import type { CatalogProduct, PrintOptionTypeName } from "@/lib/print-catalog/pricing-core";
import { PRODUCTS_API, parseInt0, sendJson, uploadProductImage, VALIDATION_MESSAGE } from "./catalog-api";

type ValueDraft = {
  key: string; id?: string; label: string; colorHex: string; imageKey: string | null; priceDelta: string;
};
type OptionDraft = {
  key: string; id?: string; name: string; help: string; type: PrintOptionTypeName; required: boolean;
  priceDelta: string; maxLength: string; values: ValueDraft[];
};

const TYPE_LABEL: Record<PrintOptionTypeName, string> = {
  CHOICE: "Choix unique",
  MULTI_CHOICE: "Choix multiple",
  COLOR: "Couleur",
  QUANTITY_SPLIT: "Répartition de quantité",
  TEXT: "Texte",
  FILE: "Fichier",
};
const hasValues = (t: PrintOptionTypeName) => t !== "TEXT" && t !== "FILE";
const newKey = () => crypto.randomUUID();

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function toDrafts(options: CatalogProduct["options"]): OptionDraft[] {
  return options
    .filter((o) => !o.archived)
    .map((o) => ({
      key: o.id,
      id: o.id,
      name: o.name,
      help: o.help ?? "",
      type: o.type,
      required: o.required,
      priceDelta: String(o.priceDelta),
      maxLength: o.maxLength === null ? "" : String(o.maxLength),
      values: o.values
        .filter((v) => !v.archived)
        .map((v) => ({
          key: v.id, id: v.id, label: v.label, colorHex: v.colorHex ?? "#000000",
          imageKey: v.imageKey, priceDelta: String(v.priceDelta),
        })),
    }));
}

function toPayload(drafts: OptionDraft[]) {
  return drafts.map((o) => {
    const withValues = hasValues(o.type);
    const delta = parseInt0(o.priceDelta);
    const maxLength = o.type === "TEXT" ? parseInt0(o.maxLength) : null;
    if (!o.name.trim()) throw new ActionError("Chaque option exige un nom.");
    if (!withValues && delta === null) throw new ActionError(`Supplément invalide pour « ${o.name} ».`);
    if (o.type === "TEXT" && (maxLength === null || maxLength < 1 || maxLength > 200)) {
      throw new ActionError(`La longueur maximale de « ${o.name} » doit être comprise entre 1 et 200.`);
    }
    if (withValues && o.values.length === 0) throw new ActionError(`« ${o.name} » exige au moins une valeur.`);
    return {
      ...(o.id ? { id: o.id } : {}),
      name: o.name.trim(),
      help: o.help.trim() === "" ? null : o.help,
      type: o.type,
      required: o.required,
      priceDelta: withValues ? 0 : (delta as number),
      maxLength,
      values: withValues
        ? o.values.map((v) => {
            const vd = parseInt0(v.priceDelta);
            if (!v.label.trim() || vd === null) throw new ActionError(`Valeur invalide dans « ${o.name} ».`);
            return {
              ...(v.id ? { id: v.id } : {}),
              label: v.label.trim(),
              colorHex: o.type === "COLOR" ? v.colorHex : null,
              imageKey: v.imageKey,
              priceDelta: vd,
            };
          })
        : [],
    };
  });
}

function ValueRow({
  v, type, disabled, first, last, onChange, onMove, onRemove,
}: {
  v: ValueDraft; type: PrintOptionTypeName; disabled: boolean; first: boolean; last: boolean;
  onChange: (patch: Partial<ValueDraft>) => void; onMove: (d: -1 | 1) => void; onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const thumb = useAsyncAction(async (file: File) => uploadProductImage(file), {
    onSuccess: (imageKey) => onChange({ imageKey }),
  });
  return (
    <li className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-40">
          <Input label="Libellé" value={v.label} maxLength={80} disabled={disabled} onChange={(e) => onChange({ label: e.target.value })} />
        </div>
        {type === "COLOR" ? (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Couleur</label>
            <input
              type="color"
              aria-label={`Couleur de ${v.label || "la valeur"}`}
              value={v.colorHex}
              disabled={disabled}
              onChange={(e) => onChange({ colorHex: e.target.value })}
              className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
            />
          </div>
        ) : null}
        <div className="w-32">
          <Input
            label="Supplément (FCFA)"
            type="number"
            min={0}
            step={1}
            value={v.priceDelta}
            disabled={disabled}
            onChange={(e) => onChange({ priceDelta: e.target.value })}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {v.imageKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/files/${v.imageKey}`} alt="" className="h-10 w-10 rounded-md border border-slate-200 object-cover" />
        ) : null}
        {disabled ? null : (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void thumb.run(f);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="secondary" disabled={thumb.pending} onClick={() => fileRef.current?.click()}>
              {v.imageKey ? "Changer la vignette" : "Ajouter une vignette"}
            </Button>
            {v.imageKey ? (
              <Button type="button" variant="secondary" onClick={() => onChange({ imageKey: null })}>
                Retirer la vignette
              </Button>
            ) : null}
            <Button type="button" variant="secondary" disabled={first} onClick={() => onMove(-1)}>Monter</Button>
            <Button type="button" variant="secondary" disabled={last} onClick={() => onMove(1)}>Descendre</Button>
            <Button type="button" variant="secondary" onClick={onRemove}>Retirer</Button>
          </>
        )}
      </div>
    </li>
  );
}

export function ProductOptionsEditor({
  productId,
  options,
  disabled,
  onSaved,
}: {
  productId: string;
  options: CatalogProduct["options"];
  disabled: boolean;
  onSaved: () => void;
}) {
  const [drafts, setDrafts] = useState<OptionDraft[]>(() => toDrafts(options));

  const patchOption = (i: number, patch: Partial<OptionDraft>) =>
    setDrafts((l) => l.map((o, k) => (k === i ? { ...o, ...patch } : o)));
  const patchValue = (i: number, j: number, patch: Partial<ValueDraft>) =>
    setDrafts((l) =>
      l.map((o, k) => (k === i ? { ...o, values: o.values.map((v, m) => (m === j ? { ...v, ...patch } : v)) } : o)),
    );

  const save = useAsyncAction(
    () => sendJson(`${PRODUCTS_API}/${productId}/options`, "PUT", { options: toPayload(drafts) }),
    { success: "Options enregistrées.", error: VALIDATION_MESSAGE, onSuccess: onSaved },
  );

  return (
    <div className="space-y-4">
      {drafts.length === 0 ? <p className="text-sm text-slate-400">Aucune option.</p> : null}
      {drafts.map((o, i) => (
        <section key={o.key} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Input label="Nom" value={o.name} maxLength={80} disabled={disabled} onChange={(e) => patchOption(i, { name: e.target.value })} />
            <Select
              label="Type"
              value={o.type}
              disabled={disabled || o.id !== undefined}
              onChange={(e) => patchOption(i, { type: e.target.value as PrintOptionTypeName })}
              options={(Object.keys(TYPE_LABEL) as PrintOptionTypeName[]).map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
            />
          </div>
          {o.id !== undefined ? (
            <p className="-mt-3 mb-4 text-xs text-slate-400">
              {"Pour changer de type, supprimez l'option et créez-en une nouvelle."}
            </p>
          ) : null}
          <Input label="Aide" value={o.help} maxLength={300} disabled={disabled} onChange={(e) => patchOption(i, { help: e.target.value })} />
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <Checkbox checked={o.required} onChange={(v) => !disabled && patchOption(i, { required: v })} label="Obligatoire" />
            {!hasValues(o.type) ? (
              <div className="w-40">
                <Input
                  label="Supplément (FCFA)"
                  type="number"
                  min={0}
                  step={1}
                  value={o.priceDelta}
                  disabled={disabled}
                  onChange={(e) => patchOption(i, { priceDelta: e.target.value })}
                />
              </div>
            ) : null}
            {o.type === "TEXT" ? (
              <div className="w-40">
                <Input
                  label="Longueur max (caractères)"
                  type="number"
                  min={1}
                  max={200}
                  step={1}
                  value={o.maxLength}
                  disabled={disabled}
                  onChange={(e) => patchOption(i, { maxLength: e.target.value })}
                />
              </div>
            ) : null}
          </div>
          {hasValues(o.type) ? (
            <>
              <ul className="space-y-2">
                {o.values.map((v, j) => (
                  <ValueRow
                    key={v.key}
                    v={v}
                    type={o.type}
                    disabled={disabled}
                    first={j === 0}
                    last={j === o.values.length - 1}
                    onChange={(patch) => patchValue(i, j, patch)}
                    onMove={(d) => patchOption(i, { values: move(o.values, j, d) })}
                    onRemove={() => patchOption(i, { values: o.values.filter((_, m) => m !== j) })}
                  />
                ))}
              </ul>
              {disabled ? null : (
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-2"
                  onClick={() =>
                    patchOption(i, {
                      values: [...o.values, { key: newKey(), label: "", colorHex: "#000000", imageKey: null, priceDelta: "0" }],
                    })
                  }
                >
                  Ajouter une valeur
                </Button>
              )}
            </>
          ) : null}
          {disabled ? null : (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variant="secondary" disabled={i === 0} onClick={() => setDrafts((l) => move(l, i, -1))}>
                Monter
              </Button>
              <Button type="button" variant="secondary" disabled={i === drafts.length - 1} onClick={() => setDrafts((l) => move(l, i, 1))}>
                Descendre
              </Button>
              <Button type="button" variant="secondary" onClick={() => setDrafts((l) => l.filter((_, k) => k !== i))}>
                {"Retirer l'option"}
              </Button>
            </div>
          )}
        </section>
      ))}
      {disabled ? null : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setDrafts((l) => [
                ...l,
                { key: newKey(), name: "", help: "", type: "CHOICE", required: false, priceDelta: "0", maxLength: "", values: [] },
              ])
            }
          >
            Ajouter une option
          </Button>
          <Button type="button" disabled={save.pending} onClick={() => void save.run()}>
            Enregistrer les options
          </Button>
        </div>
      )}
    </div>
  );
}
