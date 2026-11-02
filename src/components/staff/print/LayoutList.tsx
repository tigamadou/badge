"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui/ActionButton";
import { EmptyState } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";
import { tenthsToMm } from "@/lib/print-sheets/units";
import { BadgeWitnessPicker, useBadgeWitness } from "./BadgeWitnessPicker";
import { FLIP_LABEL, ORIENTATION_LABEL, rowSpec, type LayoutRow, type TemplateOption } from "./layout-form";
import { SheetDrawing, layoutFor } from "./SheetPreview";

const NEW_BUTTON =
  "inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700";

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
      {children}
    </span>
  );
}

export function LayoutList({
  layouts,
  templates,
  canWrite,
  initialWitness,
}: {
  layouts: LayoutRow[];
  templates: TemplateOption[];
  canWrite: boolean;
  initialWitness?: { templateId?: string; w?: string; h?: string };
}) {
  const router = useRouter();
  const witness = useBadgeWitness(templates, initialWitness);

  async function archive(id: string) {
    const res = await fetch(`/api/platform/print/layouts/${id}`, { method: "DELETE" });
    if (!res.ok) throw res;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900">Badge témoin</h2>
            <p className="text-[13px] text-slate-400">
              Sert à calculer le nombre de badges par feuille de chaque gabarit.
            </p>
          </div>
          <BadgeWitnessPicker witness={witness} templates={templates} />
        </div>
        {canWrite && (
          <Link href={`/platform/print/layouts/new?${witness.query}`} className={`${NEW_BUTTON} self-start lg:self-end`}>
            <Icon name="plus" size={16} /> Nouveau gabarit
          </Link>
        )}
      </div>

      {layouts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white">
          <EmptyState
            icon="layout-grid"
            title="Aucun gabarit"
            description="Un gabarit décrit la feuille, ses marges et la façon d'y ranger les badges."
            action={
              canWrite ? (
                <Link href={`/platform/print/layouts/new?${witness.query}`} className={NEW_BUTTON}>
                  <Icon name="plus" size={16} /> Créer le premier gabarit
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {layouts.map((l) => {
            const spec = rowSpec(l);
            const { layout, tooLarge } = layoutFor(spec, witness.badgeMm);
            const n = layout?.perSheet ?? null;
            const href = `/platform/print/layouts/${l.id}?${witness.query}`;
            return (
              <li
                key={l.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-lg hover:shadow-slate-200/70"
              >
                <Link href={href} className="block bg-[#1D2128] p-5" aria-label={`Ouvrir ${l.name}`}>
                  <SheetDrawing
                    spec={spec}
                    layout={layout}
                    showDimensions={false}
                    className="h-40 w-auto max-w-full transition group-hover:scale-[1.03]"
                  />
                </Link>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <h3 className="truncate font-semibold text-slate-900">{l.name}</h3>
                    <p className="text-sm text-slate-500">
                      {tenthsToMm(l.sheetWidth)} × {tenthsToMm(l.sheetHeight)} mm · {ORIENTATION_LABEL[l.sheetOrientation]}
                    </p>
                  </div>
                  <p className="text-sm">
                    {tooLarge ? (
                      <span className="font-medium text-rose-600">Ce badge ne tient pas dans ce gabarit</span>
                    ) : n === null ? (
                      <span className="text-slate-400">Choisissez un badge témoin</span>
                    ) : (
                      <span className="text-slate-500">
                        <span className="text-2xl font-semibold tabular-nums text-slate-900">{n}</span>{" "}
                        {n > 1 ? "badges" : "badge"} par feuille
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Chip>Retournement : {FLIP_LABEL[l.duplexFlip].toLowerCase()}</Chip>
                    {l.cropMarks && <Chip>Traits de coupe</Chip>}
                    {layout?.rotated && <Chip>Badges pivotés</Chip>}
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
                    <Link
                      href={href}
                      className="inline-flex items-center gap-1 text-[13px] font-medium text-green-700 hover:underline"
                    >
                      <Icon name={canWrite ? "pencil" : "eye"} size={14} />
                      {canWrite ? "Modifier" : "Voir"}
                    </Link>
                    {canWrite && (
                      <ActionButton
                        variant="link"
                        className="text-slate-500 hover:text-rose-600"
                        action={() => archive(l.id)}
                        success="Gabarit archivé."
                        error="Échec de l'archivage."
                        onSuccess={() => router.refresh()}
                      >
                        Archiver
                      </ActionButton>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
