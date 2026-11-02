"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui/ActionButton";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/FormControls";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { toastSuccess } from "@/lib/toast";
import { BadgeWitnessPicker, useBadgeWitness } from "./BadgeWitnessPicker";
import {
  EMPTY_FORM,
  PRESETS,
  formToBody,
  formToSpec,
  toForm,
  type LayoutForm,
  type LayoutRow,
  type TemplateOption,
} from "./layout-form";
import { SheetPreview } from "./SheetPreview";

const LIST_HREF = "/platform/print/layouts";

function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: IconName;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-green-50 text-green-700">
          <Icon name={icon} size={16} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {hint && <p className="text-[13px] text-slate-400">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

type Tile<V extends string> = { value: V; label: string; hint?: string; visual?: ReactNode };

// Choix exclusif sous forme de tuiles (radiogroup accessible).
function Tiles<V extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
  columns = "",
}: {
  label: string;
  options: Tile<V>[];
  value: V;
  onChange: (v: V) => void;
  disabled: boolean;
  columns?: string;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 text-sm font-medium text-slate-700">{label}</div>
      <div role="radiogroup" aria-label={label} className={`grid grid-cols-2 gap-2 ${columns}`}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => onChange(o.value)}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed ${
                on
                  ? "border-green-500 bg-green-50 ring-1 ring-green-500"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 disabled:hover:bg-white"
              }`}
            >
              {o.visual}
              <span className="min-w-0">
                <span className={`block text-sm font-medium ${on ? "text-green-800" : "text-slate-900"}`}>{o.label}</span>
                {o.hint && <span className="block whitespace-nowrap text-xs text-slate-500">{o.hint}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Petite feuille proportionnelle, pour les tuiles de format et d'orientation.
function Paper({ w, h, on }: { w: number; h: number; on?: boolean }) {
  const s = 28 / Math.max(w, h);
  return (
    <span className="flex h-8 w-8 flex-none items-center justify-center">
      <span
        className={`block rounded-[2px] border ${on ? "border-green-600 bg-white" : "border-slate-400 bg-white"}`}
        style={{ width: Math.round(w * s), height: Math.round(h * s) }}
      />
    </span>
  );
}

function MmInput({
  label,
  shortLabel,
  value,
  onChange,
  disabled,
  className = "",
}: {
  label: string;
  // Libellé visible plus court ; `label` reste le nom accessible du champ.
  shortLabel?: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-slate-500">{shortLabel ?? label}</span>
      <span className="relative block">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          aria-label={label}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm tabular-nums focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-slate-50 disabled:text-slate-500"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">mm</span>
      </span>
    </label>
  );
}

const MARGINS = [
  { key: "marginTop", label: "Marge haute (mm)", short: "Haut" },
  { key: "marginRight", label: "Marge droite (mm)", short: "Droite" },
  { key: "marginBottom", label: "Marge basse (mm)", short: "Bas" },
  { key: "marginLeft", label: "Marge gauche (mm)", short: "Gauche" },
] as const;

export function LayoutEditor({
  layout,
  templates,
  canWrite,
  initialWitness,
}: {
  layout: LayoutRow | null;
  templates: TemplateOption[];
  canWrite: boolean;
  initialWitness?: { templateId?: string; w?: string; h?: string };
}) {
  const router = useRouter();
  const isNew = layout === null;
  const readOnly = !canWrite;
  const [form, setForm] = useState<LayoutForm>(layout ? toForm(layout) : EMPTY_FORM);
  const [nameError, setNameError] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [linkedMargins, setLinkedMargins] = useState(() => {
    const f = layout ? toForm(layout) : EMPTY_FORM;
    return new Set([f.marginTop, f.marginRight, f.marginBottom, f.marginLeft]).size === 1;
  });
  const witness = useBadgeWitness(templates, initialWitness);
  const listHref = `${LIST_HREF}?${witness.query}`;

  const set = <K extends keyof LayoutForm>(k: K, v: LayoutForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const spec = formToSpec(form);
  const canSave = spec !== null && form.name.trim() !== "";

  function setMargin(key: (typeof MARGINS)[number]["key"], v: string) {
    setForm((f) =>
      linkedMargins ? { ...f, marginTop: v, marginRight: v, marginBottom: v, marginLeft: v } : { ...f, [key]: v },
    );
  }

  function choosePreset(p: string) {
    setSizeError(null);
    setForm((f) =>
      p === "FREE"
        ? { ...f, preset: p }
        : { ...f, preset: p, sheetWidth: String(PRESETS[p].w), sheetHeight: String(PRESETS[p].h) },
    );
  }

  const save = useAsyncAction(
    async (): Promise<{ nameError?: string; sizeError?: string }> => {
      const res = await fetch(isNew ? "/api/platform/print/layouts" : `/api/platform/print/layouts/${layout?.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formToBody(form)),
      });
      if (!res.ok) {
        const j = await res.clone().json().catch(() => ({}));
        if (j.error === "NAME_TAKEN") return { nameError: "Ce nom de gabarit existe déjà." };
        if (
          j.error === "VALIDATION" &&
          Array.isArray(j.issues) &&
          j.issues.some((i: { path?: unknown[] }) => i.path?.[0] === "sheetWidth")
        ) {
          return { sizeError: "La largeur de la planche doit être inférieure ou égale à sa hauteur." };
        }
        throw res;
      }
      return {};
    },
    {
      error: "Échec de l'enregistrement du gabarit.",
      onSuccess: (r) => {
        if (r.nameError) return setNameError(r.nameError);
        if (r.sizeError) return setSizeError(r.sizeError);
        toastSuccess(isNew ? "Gabarit créé." : "Gabarit mis à jour.");
        router.push(listHref);
        router.refresh();
      },
    },
  );

  async function archive() {
    const res = await fetch(`/api/platform/print/layouts/${layout?.id}`, { method: "DELETE" });
    if (!res.ok) throw res;
  }

  const sheetW = Number(form.sheetWidth) || 1;
  const sheetH = Number(form.sheetHeight) || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <Link href={listHref} className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-500 hover:text-slate-900">
            <Icon name="arrow-left" size={14} /> Gabarits d&apos;impression
          </Link>
          <h1 className="mt-1 truncate text-xl font-semibold text-slate-900">
            {isNew ? "Nouveau gabarit" : form.name.trim() || "Gabarit sans nom"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isNew && canWrite && (
            <ActionButton
              variant="secondary"
              action={archive}
              confirm="Archiver ce gabarit ? Il ne pourra plus servir à générer des planches."
              success="Gabarit archivé."
              error="Échec de l'archivage."
              onSuccess={() => {
                router.push(listHref);
                router.refresh();
              }}
            >
              Archiver
            </ActionButton>
          )}
          <Link href={listHref} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
            {canWrite ? "Annuler" : "Retour"}
          </Link>
          {canWrite && (
            <Button
              type="button"
              loading={save.pending}
              disabled={!canSave}
              onClick={() => {
                setNameError(null);
                setSizeError(null);
                void save.run();
              }}
            >
              Enregistrer
            </Button>
          )}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <aside className="space-y-4 rounded-2xl bg-[#1D2128] p-5 text-white lg:sticky lg:top-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Aperçu en direct</h2>
            <span className="flex items-center gap-1.5 text-xs text-white/50">
              <span className="h-2 w-2 rounded-full bg-green-400" /> Mis à jour à chaque saisie
            </span>
          </div>
          <BadgeWitnessPicker witness={witness} templates={templates} tone="dark" />
          {spec ? (
            <SheetPreview spec={spec} badgeMm={witness.badgeMm} drawingClassName="h-auto max-h-[72vh] w-full" />
          ) : (
            <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/60">
              Saisissez des dimensions valides pour voir l&apos;aperçu.
            </p>
          )}
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-3.5 rounded-sm border border-dashed border-sky-400" /> Zone utile
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-3.5 rounded-sm border border-green-600 bg-green-100" /> Emplacement
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-px w-3.5 bg-white/70" /> Traits de coupe
            </li>
          </ul>
        </aside>
        <div className="space-y-5">
          <Section icon="tag" title="Identité" hint="Le nom permet de retrouver le gabarit à la génération.">
            <Input
              label="Nom"
              value={form.name}
              disabled={readOnly}
              placeholder="Ex. A3 sans marge perdue"
              error={nameError ?? undefined}
              onChange={(e) => {
                setNameError(null);
                set("name", e.target.value);
              }}
            />
          </Section>

          <Section icon="file" title="Feuille" hint="Format du papier de l'imprimeur et sens d'impression.">
            <Tiles
              label="Format"
              value={form.preset}
              disabled={readOnly}
              onChange={choosePreset}
              options={[
                ...Object.entries(PRESETS).map(([value, p]) => ({
                  value,
                  label: p.label,
                  hint: `${p.w} × ${p.h}`,
                  visual: <Paper w={p.w} h={p.h} on={form.preset === value} />,
                })),
                { value: "FREE", label: "Libre", hint: "Sur mesure", visual: <Paper w={sheetW} h={sheetH} on={form.preset === "FREE"} /> },
              ]}
            />
            {form.preset === "FREE" && (
              <div className="mb-4 grid grid-cols-2 gap-3">
                <MmInput
                  label="Largeur (mm)"
                  value={form.sheetWidth}
                  disabled={readOnly}
                  onChange={(v) => {
                    setSizeError(null);
                    set("sheetWidth", v);
                  }}
                />
                <MmInput
                  label="Hauteur (mm)"
                  value={form.sheetHeight}
                  disabled={readOnly}
                  onChange={(v) => {
                    setSizeError(null);
                    set("sheetHeight", v);
                  }}
                />
              </div>
            )}
            {sizeError && <p className="mb-4 text-sm text-rose-600">{sizeError}</p>}
            <Tiles
              label="Orientation de la feuille"
              value={form.sheetOrientation}
              disabled={readOnly}
              onChange={(v) => set("sheetOrientation", v)}
              options={[
                { value: "PORTRAIT", label: "Portrait", visual: <Paper w={21} h={29.7} on={form.sheetOrientation === "PORTRAIT"} /> },
                { value: "LANDSCAPE", label: "Paysage", visual: <Paper w={29.7} h={21} on={form.sheetOrientation === "LANDSCAPE"} /> },
              ]}
            />
          </Section>

          <Section icon="sliders" title="Marges et espacements" hint="Distances au bord de la feuille et entre les badges.">
            <div className="mb-4 rounded-xl bg-slate-50 p-4">
              <div className="mx-auto grid max-w-md grid-cols-[1fr_minmax(0,1.2fr)_1fr] items-center gap-3">
                <span />
                <MmInput label={MARGINS[0].label} shortLabel={MARGINS[0].short} value={form.marginTop} disabled={readOnly} onChange={(v) => setMargin("marginTop", v)} />
                <span />
                <MmInput label={MARGINS[3].label} shortLabel={MARGINS[3].short} value={form.marginLeft} disabled={readOnly} onChange={(v) => setMargin("marginLeft", v)} />
                <div className="flex aspect-[3/4] items-center justify-center rounded-md border-2 border-dashed border-sky-400 bg-white text-center text-xs font-medium text-sky-600">
                  Zone
                  <br />
                  utile
                </div>
                <MmInput label={MARGINS[1].label} shortLabel={MARGINS[1].short} value={form.marginRight} disabled={readOnly} onChange={(v) => setMargin("marginRight", v)} />
                <span />
                <MmInput label={MARGINS[2].label} shortLabel={MARGINS[2].short} value={form.marginBottom} disabled={readOnly} onChange={(v) => setMargin("marginBottom", v)} />
                <span />
              </div>
              <div className="mt-3 flex justify-center">
                <Switch
                  checked={linkedMargins}
                  onChange={(v) => {
                    if (readOnly) return;
                    setLinkedMargins(v);
                    if (v) setMargin("marginTop", form.marginTop);
                  }}
                  label="Marges identiques"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MmInput label="Espace horizontal (mm)" value={form.gapHorizontal} disabled={readOnly} onChange={(v) => set("gapHorizontal", v)} />
              <MmInput label="Espace vertical (mm)" value={form.gapVertical} disabled={readOnly} onChange={(v) => set("gapVertical", v)} />
            </div>
          </Section>

          <Section icon="layout-grid" title="Disposition des badges" hint="Faire pivoter les badges peut en placer davantage par feuille.">
            <Tiles
              label="Orientation des badges"
              value={form.badgeOrientation}
              disabled={readOnly}
              onChange={(v) => set("badgeOrientation", v)}
              options={[
                { value: "AUTO", label: "Automatique", hint: "Le plus de badges" },
                { value: "ORIGINAL", label: "Originale", hint: "Sens du template" },
                { value: "ROTATED", label: "Pivotée", hint: "Tournés de 90°" },
              ]}
            />
          </Section>

          <Section icon="printer" title="Impression" hint="À régler selon la presse : vérifiez sur une planche de contrôle.">
            <Tiles
              label="Retournement recto verso"
              value={form.duplexFlip}
              disabled={readOnly}
              onChange={(v) => set("duplexFlip", v)}
              options={[
                { value: "LONG_EDGE", label: "Bord long", hint: "Le plus courant" },
                { value: "SHORT_EDGE", label: "Bord court", hint: "Retournement « calendrier »" },
              ]}
            />
            <Switch
              checked={form.cropMarks}
              onChange={(v) => !readOnly && set("cropMarks", v)}
              label="Traits de coupe"
            />
          </Section>
        </div>

      </div>
    </div>
  );
}
