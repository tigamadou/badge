"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui/ActionButton";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHead } from "@/components/ui/Card";
import { Switch } from "@/components/ui/FormControls";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Segmented } from "@/components/ui/Tabs";
import { SheetPreview } from "@/components/staff/print/SheetPreview";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { toastSuccess } from "@/lib/toast";
import {
  BadgeTooLargeError,
  computeSheetLayout,
  type LayoutSpec,
} from "@/lib/print-sheets/compute-layout";
import { mmToTenths, tenthsToMm } from "@/lib/print-sheets/units";

// Longueurs en dixièmes de mm, comme en base.
export type LayoutRow = {
  id: string;
  name: string;
  sheetWidth: number;
  sheetHeight: number;
  sheetOrientation: "PORTRAIT" | "LANDSCAPE";
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  gapHorizontal: number;
  gapVertical: number;
  badgeOrientation: "AUTO" | "ORIGINAL" | "ROTATED";
  duplexFlip: "LONG_EDGE" | "SHORT_EDGE";
  cropMarks: boolean;
};

export type TemplateOption = { id: string; label: string; widthMm: number; heightMm: number };

const PRESETS: Record<string, { label: string; w: number; h: number }> = {
  A3: { label: "A3 (297 × 420)", w: 297, h: 420 },
  A4: { label: "A4 (210 × 297)", w: 210, h: 297 },
  SRA3: { label: "SRA3 (320 × 450)", w: 320, h: 450 },
};

type Form = {
  name: string;
  preset: string; // A3 | A4 | SRA3 | FREE
  sheetWidth: string;
  sheetHeight: string;
  sheetOrientation: "PORTRAIT" | "LANDSCAPE";
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  gapHorizontal: string;
  gapVertical: string;
  badgeOrientation: "AUTO" | "ORIGINAL" | "ROTATED";
  duplexFlip: "LONG_EDGE" | "SHORT_EDGE";
  cropMarks: boolean;
};

const mmStr = (tenths: number) => String(tenthsToMm(tenths));

const EMPTY_FORM: Form = {
  name: "",
  preset: "A3",
  sheetWidth: "297",
  sheetHeight: "420",
  sheetOrientation: "PORTRAIT",
  marginTop: "10",
  marginRight: "10",
  marginBottom: "10",
  marginLeft: "10",
  gapHorizontal: "0",
  gapVertical: "0",
  badgeOrientation: "AUTO",
  duplexFlip: "LONG_EDGE",
  cropMarks: true,
};

function toForm(r: LayoutRow): Form {
  const w = tenthsToMm(r.sheetWidth);
  const h = tenthsToMm(r.sheetHeight);
  const preset = Object.entries(PRESETS).find(([, p]) => p.w === w && p.h === h)?.[0] ?? "FREE";
  return {
    name: r.name,
    preset,
    sheetWidth: String(w),
    sheetHeight: String(h),
    sheetOrientation: r.sheetOrientation,
    marginTop: mmStr(r.marginTop),
    marginRight: mmStr(r.marginRight),
    marginBottom: mmStr(r.marginBottom),
    marginLeft: mmStr(r.marginLeft),
    gapHorizontal: mmStr(r.gapHorizontal),
    gapVertical: mmStr(r.gapVertical),
    badgeOrientation: r.badgeOrientation,
    duplexFlip: r.duplexFlip,
    cropMarks: r.cropMarks,
  };
}

// Saisie en mm -> nombre, ou null si vide / invalide.
function parseMm(v: string): number | null {
  const n = Number(v.replace(",", "."));
  return v.trim() !== "" && Number.isFinite(n) ? n : null;
}

// Spec pour l'aperçu ; null tant qu'une valeur est invalide.
function formToSpec(f: Form): LayoutSpec | null {
  const nums = [
    f.sheetWidth, f.sheetHeight, f.marginTop, f.marginRight, f.marginBottom,
    f.marginLeft, f.gapHorizontal, f.gapVertical,
  ].map(parseMm);
  if (nums.some((n) => n === null || n < 0)) return null;
  const [sw, sh, mt, mr, mb, ml, gh, gv] = nums as number[];
  if (sw <= 0 || sh <= 0) return null;
  return {
    sheetWidthMm: sw,
    sheetHeightMm: sh,
    sheetOrientation: f.sheetOrientation,
    marginsMm: { top: mt, right: mr, bottom: mb, left: ml },
    gapHorizontalMm: gh,
    gapVerticalMm: gv,
    badgeOrientation: f.badgeOrientation,
    duplexFlip: f.duplexFlip,
    cropMarks: f.cropMarks,
  };
}

function formToBody(f: Form) {
  const t = (v: string) => mmToTenths(parseMm(v) ?? 0);
  return {
    name: f.name.trim(),
    sheetWidth: t(f.sheetWidth),
    sheetHeight: t(f.sheetHeight),
    sheetOrientation: f.sheetOrientation,
    marginTop: t(f.marginTop),
    marginRight: t(f.marginRight),
    marginBottom: t(f.marginBottom),
    marginLeft: t(f.marginLeft),
    gapHorizontal: t(f.gapHorizontal),
    gapVertical: t(f.gapVertical),
    badgeOrientation: f.badgeOrientation,
    duplexFlip: f.duplexFlip,
    cropMarks: f.cropMarks,
  };
}

function rowSpec(r: LayoutRow): LayoutSpec {
  return formToSpec(toForm(r)) as LayoutSpec;
}

function perSheetFor(spec: LayoutSpec | null, badge: { width: number; height: number } | null) {
  if (!spec || !badge) return null;
  try {
    return computeSheetLayout(spec, { widthMm: badge.width, heightMm: badge.height }).perSheet;
  } catch (err) {
    if (err instanceof BadgeTooLargeError) return 0;
    throw err;
  }
}

const ORIENTATION_LABEL = { PORTRAIT: "Portrait", LANDSCAPE: "Paysage" };

function MmField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <Input
      label={label}
      type="number"
      inputMode="decimal"
      step="0.1"
      min="0"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function LayoutManager({
  layouts,
  templates,
  canWrite,
}: {
  layouts: LayoutRow[];
  templates: TemplateOption[];
  canWrite: boolean;
}) {
  const router = useRouter();
  // null = formulaire fermé ; "new" = création ; sinon identifiant du gabarit édité.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [nameError, setNameError] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);

  // Badge témoin : "" = aucun, "free" = taille libre, sinon id de template.
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "free");
  const [freeW, setFreeW] = useState("84");
  const [freeH, setFreeH] = useState("120");

  const badgeMm = useMemo(() => {
    if (templateId === "free") {
      const w = parseMm(freeW);
      const h = parseMm(freeH);
      return w && h && w > 0 && h > 0 ? { width: w, height: h } : null;
    }
    const t = templates.find((x) => x.id === templateId);
    return t ? { width: t.widthMm, height: t.heightMm } : null;
  }, [templateId, freeW, freeH, templates]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const spec = formToSpec(form);
  const readOnly = !canWrite;

  function open(id: string, f: Form) {
    setEditingId(id);
    setForm(f);
    setNameError(null);
    setSizeError(null);
  }

  function choosePreset(p: string) {
    setForm((f) =>
      p === "FREE"
        ? { ...f, preset: p }
        : { ...f, preset: p, sheetWidth: String(PRESETS[p].w), sheetHeight: String(PRESETS[p].h) },
    );
  }

  const save = useAsyncAction(
    async (): Promise<{ nameError?: string; sizeError?: string }> => {
      const isNew = editingId === "new";
      const res = await fetch(
        isNew ? "/api/platform/print/layouts" : `/api/platform/print/layouts/${editingId}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(formToBody(form)),
        },
      );
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
        toastSuccess(editingId === "new" ? "Gabarit créé." : "Gabarit mis à jour.");
        setEditingId(null);
        router.refresh();
      },
    },
  );

  async function archive(id: string) {
    const res = await fetch(`/api/platform/print/layouts/${id}`, { method: "DELETE" });
    if (!res.ok) throw res;
  }

  const canSave = spec !== null && form.name.trim() !== "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHead
          title="Badge témoin"
          subtitle="Sert à calculer le nombre de badges par feuille dans la liste et l'aperçu."
        />
        <CardBody className="grid gap-x-4 sm:grid-cols-3">
          <Select
            label="Template installé"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            options={[
              ...templates.map((t) => ({
                value: t.id,
                label: `${t.label} (${t.widthMm.toFixed(1)} × ${t.heightMm.toFixed(1)} mm)`,
              })),
              { value: "free", label: "Taille libre" },
            ]}
          />
          {templateId === "free" && (
            <>
              <MmField label="Largeur du badge (mm)" value={freeW} onChange={setFreeW} disabled={false} />
              <MmField label="Hauteur du badge (mm)" value={freeH} onChange={setFreeH} disabled={false} />
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHead
          title="Gabarits"
          action={
            canWrite ? (
              <Button type="button" onClick={() => open("new", EMPTY_FORM)}>
                Nouveau gabarit
              </Button>
            ) : undefined
          }
        />
        <CardBody className="px-0 py-0">
          {layouts.length === 0 ? (
            <p className="px-6 py-6 text-center text-sm text-slate-400">Aucun gabarit.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {layouts.map((l) => {
                const n = perSheetFor(rowSpec(l), badgeMm);
                return (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900">{l.name}</div>
                      <div className="text-slate-500">
                        {tenthsToMm(l.sheetWidth)} × {tenthsToMm(l.sheetHeight)} mm ·{" "}
                        {ORIENTATION_LABEL[l.sheetOrientation]}
                        {" · "}
                        {n === null
                          ? "—"
                          : n === 0
                            ? "Ce badge ne tient pas dans ce gabarit"
                            : `${n} ${n > 1 ? "badges" : "badge"} par feuille`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="link"
                        className="text-slate-700"
                        onClick={() => open(l.id, toForm(l))}
                      >
                        {canWrite ? "Modifier" : "Voir"}
                      </Button>
                      {canWrite && (
                        <ActionButton
                          variant="link"
                          className="text-slate-700"
                          action={() => archive(l.id)}
                          success="Gabarit archivé."
                          error="Échec de l'archivage."
                          onSuccess={() => {
                            if (editingId === l.id) setEditingId(null);
                            router.refresh();
                          }}
                        >
                          Archiver
                        </ActionButton>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {editingId && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHead title={editingId === "new" ? "Nouveau gabarit" : "Gabarit"} />
            <CardBody>
              <Input
                label="Nom"
                value={form.name}
                disabled={readOnly}
                error={nameError ?? undefined}
                onChange={(e) => {
                  setNameError(null);
                  set("name", e.target.value);
                }}
              />
              <Select
                label="Format"
                value={form.preset}
                disabled={readOnly}
                onChange={(e) => choosePreset(e.target.value || "FREE")}
                options={[
                  ...Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label })),
                  { value: "FREE", label: "Format libre" },
                ]}
              />
              <div className="grid grid-cols-2 gap-x-4">
                <MmField
                  label="Largeur (mm)"
                  value={form.sheetWidth}
                  disabled={readOnly || form.preset !== "FREE"}
                  onChange={(v) => {
                    setSizeError(null);
                    set("sheetWidth", v);
                  }}
                />
                <MmField
                  label="Hauteur (mm)"
                  value={form.sheetHeight}
                  disabled={readOnly || form.preset !== "FREE"}
                  onChange={(v) => {
                    setSizeError(null);
                    set("sheetHeight", v);
                  }}
                />
              </div>
              {sizeError && <p className="-mt-2 mb-4 text-sm text-rose-600">{sizeError}</p>}

              <div className="mb-4 space-y-1">
                <div className="text-sm font-medium text-slate-700">Orientation de la feuille</div>
                <Segmented
                  options={[
                    { value: "PORTRAIT", label: "Portrait" },
                    { value: "LANDSCAPE", label: "Paysage" },
                  ]}
                  value={form.sheetOrientation}
                  onChange={(v) => !readOnly && set("sheetOrientation", v as Form["sheetOrientation"])}
                />
              </div>

              <div className="grid grid-cols-2 gap-x-4">
                <MmField label="Marge haute (mm)" value={form.marginTop} disabled={readOnly} onChange={(v) => set("marginTop", v)} />
                <MmField label="Marge droite (mm)" value={form.marginRight} disabled={readOnly} onChange={(v) => set("marginRight", v)} />
                <MmField label="Marge basse (mm)" value={form.marginBottom} disabled={readOnly} onChange={(v) => set("marginBottom", v)} />
                <MmField label="Marge gauche (mm)" value={form.marginLeft} disabled={readOnly} onChange={(v) => set("marginLeft", v)} />
                <MmField label="Espace horizontal (mm)" value={form.gapHorizontal} disabled={readOnly} onChange={(v) => set("gapHorizontal", v)} />
                <MmField label="Espace vertical (mm)" value={form.gapVertical} disabled={readOnly} onChange={(v) => set("gapVertical", v)} />
              </div>

              <div className="mb-4 space-y-1">
                <div className="text-sm font-medium text-slate-700">Orientation des badges</div>
                <Segmented
                  options={[
                    { value: "AUTO", label: "Automatique" },
                    { value: "ORIGINAL", label: "Originale" },
                    { value: "ROTATED", label: "Pivotée" },
                  ]}
                  value={form.badgeOrientation}
                  onChange={(v) => !readOnly && set("badgeOrientation", v as Form["badgeOrientation"])}
                />
              </div>

              <div className="mb-4 space-y-1">
                <div className="text-sm font-medium text-slate-700">Retournement recto verso</div>
                <Segmented
                  options={[
                    { value: "LONG_EDGE", label: "Bord long" },
                    { value: "SHORT_EDGE", label: "Bord court" },
                  ]}
                  value={form.duplexFlip}
                  onChange={(v) => !readOnly && set("duplexFlip", v as Form["duplexFlip"])}
                />
              </div>

              <div className="mb-4">
                <Switch
                  checked={form.cropMarks}
                  onChange={(v) => !readOnly && set("cropMarks", v)}
                  label="Traits de coupe"
                />
              </div>

              <div className="flex flex-wrap gap-2">
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
                <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                  {canWrite ? "Annuler" : "Fermer"}
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card className="self-start">
            <CardHead title="Aperçu" />
            <CardBody>
              {spec ? (
                <SheetPreview spec={spec} badgeMm={badgeMm} />
              ) : (
                <p className="text-sm text-slate-500">Saisissez des dimensions valides pour voir l&apos;aperçu.</p>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
