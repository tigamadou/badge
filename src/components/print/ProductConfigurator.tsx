"use client";
import { useId, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/FormControls";
import { Dropzone, FileBox } from "@/components/ui/FileBox";
import {
  unitPriceFor,
  validateChoices,
  choiceErrorMessage,
  formatFcfa,
  type CatalogProduct,
  type OptionChoice,
  type PricingOption,
} from "@/lib/print-catalog/pricing-core";
import { ProductGallery } from "./ProductGallery";

// quantity peut valoir NaN tant que le champ est vide : valider avant tout envoi.
export type ProductConfiguration = { quantity: number; choices: OptionChoice[] };

const supplement = (delta: number) => (delta > 0 ? ` (+${formatFcfa(delta)})` : "");
const isEmpty = (c: OptionChoice) => !c.valueIds?.length && !c.text && !c.fileKey && !c.split?.length;

// Cliquer la pastille deja choisie d'une option facultative la deselectionne.
export function nextColorChoice(option: PricingOption, selected: string[], valueId: string): OptionChoice | null {
  return !option.required && selected.includes(valueId) ? null : { optionId: option.id, valueIds: [valueId] };
}

function ErrorText({ children }: { children: string }) {
  return <p className="mt-1 text-sm text-rose-600">{children}</p>;
}

function FileField({
  option,
  choice,
  uploadFile,
  onChange,
}: {
  option: PricingOption;
  choice: OptionChoice | undefined;
  uploadFile?: (file: File) => Promise<string>;
  onChange: (next: OptionChoice | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!uploadFile) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[13px] text-slate-400">
        {"Téléversement disponible dans la demande d'impression"}
      </p>
    );
  }
  if (choice?.fileKey) {
    return (
      <FileBox
        title={choice.fileKey.split("/").pop()}
        subtitle={option.priceDelta > 0 ? `Supplément${supplement(option.priceDelta)}` : undefined}
        action={
          <button type="button" className="text-xs text-rose-600" onClick={() => onChange(null)}>
            Retirer
          </button>
        }
      />
    );
  }
  async function pick(files: FileList) {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const fileKey = await uploadFile!(files[0]);
      onChange({ optionId: option.id, fileKey });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Dropzone
        onFiles={pick}
        title={busy ? "Téléversement en cours…" : "Déposez un fichier ou cliquez"}
        subtitle="JPEG, PNG, WebP ou PDF, 5 Mo maximum"
        accept="image/jpeg,image/png,image/webp,application/pdf"
      />
      {failed ? <ErrorText>{"Le téléversement a échoué. Réessayez."}</ErrorText> : null}
    </>
  );
}

function OptionField({
  option,
  choice,
  quantity,
  uploadFile,
  error,
  onChange,
}: {
  option: PricingOption;
  choice: OptionChoice | undefined;
  quantity: number;
  uploadFile?: (file: File) => Promise<string>;
  error?: string;
  onChange: (next: OptionChoice | null) => void;
}) {
  const label = option.required ? `${option.name} *` : option.name;
  const selected = choice?.valueIds ?? [];
  const labelId = useId();
  let field;
  switch (option.type) {
    case "CHOICE":
      field = (
        <Select
          label={label}
          value={selected[0] ?? ""}
          options={option.values.map((val) => ({ value: val.id, label: `${val.label}${supplement(val.priceDelta)}` }))}
          error={error}
          onChange={(e) => onChange(e.target.value ? { optionId: option.id, valueIds: [e.target.value] } : null)}
        />
      );
      break;
    case "MULTI_CHOICE":
      field = (
        <fieldset className="mb-4">
          <legend className="mb-1 text-sm font-medium text-slate-700">{label}</legend>
          <div className="flex flex-col gap-2">
            {option.values.map((val) => (
              <Checkbox
                key={val.id}
                checked={selected.includes(val.id)}
                label={`${val.label}${supplement(val.priceDelta)}`}
                onChange={(on) => {
                  const ids = on ? [...selected, val.id] : selected.filter((id) => id !== val.id);
                  onChange(ids.length ? { optionId: option.id, valueIds: ids } : null);
                }}
              />
            ))}
          </div>
          {error ? <ErrorText>{error}</ErrorText> : null}
        </fieldset>
      );
      break;
    case "COLOR":
      field = (
        <div className="mb-4">
          <div id={labelId} className="mb-1 text-sm font-medium text-slate-700">{label}</div>
          <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
            {option.values.map((val) => (
              <button
                key={val.id}
                type="button"
                aria-label={`${val.label}${supplement(val.priceDelta)}`}
                aria-pressed={selected.includes(val.id)}
                title={`${val.label}${supplement(val.priceDelta)}`}
                onClick={() => onChange(nextColorChoice(option, selected, val.id))}
                style={{ backgroundColor: val.colorHex ?? undefined }}
                className={`h-8 w-8 rounded-full border border-slate-300 ${
                  selected.includes(val.id) ? "ring-2 ring-green-600 ring-offset-2" : ""
                }`}
              />
            ))}
          </div>
          {error ? <ErrorText>{error}</ErrorText> : null}
        </div>
      );
      break;
    case "TEXT": {
      const text = choice?.text ?? "";
      field = (
        <div>
          <Input
            label={`${label}${supplement(option.priceDelta)}`}
            value={text}
            maxLength={option.maxLength ?? undefined}
            error={error}
            onChange={(e) => onChange(e.target.value ? { optionId: option.id, text: e.target.value } : null)}
          />
          {option.maxLength !== null ? (
            <p className="-mt-3 mb-4 text-right text-xs text-slate-400">{`${text.length}/${option.maxLength}`}</p>
          ) : null}
        </div>
      );
      break;
    }
    case "FILE":
      field = (
        <div className="mb-4">
          <div className="mb-1 text-sm font-medium text-slate-700">{label}</div>
          <FileField option={option} choice={choice} uploadFile={uploadFile} onChange={onChange} />
          {error ? <ErrorText>{error}</ErrorText> : null}
        </div>
      );
      break;
    default: {
      // QUANTITY_SPLIT
      const parts = choice?.split ?? [];
      const total = parts.reduce((sum, part) => sum + part.quantity, 0);
      field = (
        <div className="mb-4">
          <div className="mb-1 text-sm font-medium text-slate-700">{label}</div>
          <div className="grid grid-cols-2 gap-x-3 sm:grid-cols-3">
            {option.values.map((val) => (
              <Input
                key={val.id}
                type="number"
                min={0}
                label={`${val.label}${supplement(val.priceDelta)}`}
                value={parts.find((part) => part.valueId === val.id)?.quantity ?? ""}
                onChange={(e) => {
                  const n = Math.max(0, Math.trunc(Number(e.target.value)));
                  const rest = parts.filter((part) => part.valueId !== val.id);
                  const next = n > 0 ? [...rest, { valueId: val.id, quantity: n }] : rest;
                  onChange(next.length ? { optionId: option.id, split: next } : null);
                }}
              />
            ))}
          </div>
          <p className="text-xs text-slate-500">{`Réparti : ${total} / ${quantity}`}</p>
          {error ? <ErrorText>{error}</ErrorText> : null}
        </div>
      );
    }
  }
  return (
    <div>
      {field}
      {option.help ? <p className="-mt-3 mb-4 text-xs text-slate-400">{option.help}</p> : null}
    </div>
  );
}

// Composant controle : l'etat (quantite + choix) vit chez le parent.
export function ProductConfigurator({
  product,
  value,
  onChange,
  uploadFile,
  quantityLocked,
}: {
  product: CatalogProduct;
  value: ProductConfiguration;
  onChange: (next: ProductConfiguration) => void;
  uploadFile?: (file: File) => Promise<string>;
  quantityLocked?: boolean;
}) {
  const result = validateChoices(product, value.choices, value.quantity);
  const partial = !result.ok && result.code === "REQUIRED_OPTION_MISSING";
  const showPrice = result.ok || partial;
  const unit = showPrice ? unitPriceFor(product, value.quantity, value.choices) : 0;
  const errorFor = (optionId: string) =>
    !result.ok && result.optionId === optionId ? choiceErrorMessage(result.code) : undefined;
  const quantityError = !result.ok && !result.optionId ? choiceErrorMessage(result.code) : undefined;

  function setChoice(optionId: string, next: OptionChoice | null) {
    const others = value.choices.filter((c) => c.optionId !== optionId);
    onChange({ ...value, choices: next && !isEmpty(next) ? [...others, next] : others });
  }

  const paragraphs = (product.description ?? "").split(/\n\s*\n/).filter((p) => p.trim());
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ProductGallery images={product.images} />
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{product.name}</h2>
        {paragraphs.map((p, i) => (
          <p key={i} className="mt-2 whitespace-pre-line text-sm text-slate-600">{p}</p>
        ))}
        <div className="mt-4">
          {product.options.map((option) => (
            <OptionField
              key={option.id}
              option={option}
              choice={value.choices.find((c) => c.optionId === option.id)}
              quantity={value.quantity}
              uploadFile={uploadFile}
              error={errorFor(option.id)}
              onChange={(next) => setChoice(option.id, next)}
            />
          ))}
          <Input
            type="number"
            label="Quantité"
            min={product.minQuantity}
            value={Number.isNaN(value.quantity) ? "" : value.quantity}
            readOnly={quantityLocked}
            error={quantityError}
            onChange={(e) => onChange({ ...value, quantity: e.target.value === "" ? NaN : Number(e.target.value) })}
          />
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          {showPrice ? (
            <>
              <div className="flex justify-between"><span>Prix unitaire estimé</span><strong>{formatFcfa(unit)}</strong></div>
              <div className="mt-1 flex justify-between"><span>Total estimé</span><strong>{formatFcfa(unit * value.quantity)}</strong></div>
            </>
          ) : null}
          {partial ? (
            <p className="mt-2 text-xs text-amber-700">{"Estimation partielle : options obligatoires manquantes."}</p>
          ) : null}
          <p className="mt-2 text-xs text-slate-400">{"Estimation : le prix définitif est fixé dans le devis."}</p>
        </div>
      </div>
    </div>
  );
}
