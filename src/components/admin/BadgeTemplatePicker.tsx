"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { RoleBadge } from "@/components/ui/Labels";
import { TemplatePreview } from "@/components/ui/TemplatePreview";
import { useAsyncAction } from "@/hooks/useAsyncAction";

export type TemplateSummary = {
  id: string;
  label: string;
  description: string;
  pages: number;
  pageSize: { width: string; height: string };
  previewSrc: string;
  onsite: boolean;
};

export type EffectiveLevel = "event" | "org" | "platform";

const LEVEL_LABEL: Record<EffectiveLevel, string> = {
  event: "evenement",
  org: "organisation",
  platform: "plateforme",
};

type Props = {
  templates: TemplateSummary[];
  currentValue: string | null;
  effectiveId: string;
  effectiveLevel: EffectiveLevel;
  patchUrl: string;
  canClearToInherit: boolean;
  // Motif de verrouillage : encadré d'avertissement et boutons désactivés.
  lockedReason?: string;
};

export default function BadgeTemplatePicker({
  templates,
  currentValue,
  effectiveId,
  effectiveLevel,
  patchUrl,
  canClearToInherit,
  lockedReason,
}: Props) {
  const router = useRouter();
  const save = useAsyncAction(
    async (badgeTemplateId: string | null) => {
      const res = await fetch(patchUrl, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ badgeTemplateId }),
      });
      if (!res.ok) throw res;
    },
    { success: "Template enregistré.", error: "Échec de la sauvegarde.", onSuccess: () => router.refresh() },
  );
  const locked = lockedReason !== undefined;
  const { pending } = save;

  return (
    <div className="space-y-5">
      {locked && (
        <div
          role="alert"
          data-testid="template-locked"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {lockedReason}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <p className="text-slate-600">
          Template effectif : <span className="font-mono text-slate-900">{effectiveId}</span>{" "}
          <span className="text-slate-400">(niveau {LEVEL_LABEL[effectiveLevel]})</span>
        </p>
        {canClearToInherit && currentValue !== null && (
          <Button
            variant="link"
            className="text-green-600"
            onClick={() => save.run(null)}
            loading={pending}
            disabled={locked}
          >
            Utiliser le défaut hérité
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {templates.map((tpl) => {
          const isCurrent = currentValue === tpl.id;
          const isEffective = effectiveId === tpl.id;
          return (
            <div
              key={tpl.id}
              data-testid={`template-card-${tpl.id}`}
              data-selected={isCurrent ? "true" : "false"}
              className={`space-y-3 rounded-xl border bg-white p-4 ${
                isCurrent ? "border-green-600 ring-1 ring-green-600" : "border-slate-200"
              }`}
            >
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                <TemplatePreview src={tpl.previewSrc} label={tpl.label} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{tpl.label}</h3>
                  {tpl.onsite && (
                    <span role="img" aria-label="Impression sur place" title="Impression sur place" className="text-slate-500">
                      <Icon name="printer" size={14} />
                    </span>
                  )}
                  {isCurrent && <RoleBadge tone="green">✅ Sélectionné</RoleBadge>}
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Format {tpl.pageSize.width} × {tpl.pageSize.height} · {tpl.pages} page{tpl.pages > 1 ? "s" : ""}
                </p>
                <p className="mt-2 text-[13px] text-slate-600">{tpl.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => save.run(tpl.id)}
                  disabled={pending || isCurrent || locked}
                  data-testid={`select-${tpl.id}`}
                  hidden={isCurrent}
                >
                  {isCurrent ? "Sélectionné" : "Sélectionner"}
                </Button>
                {isEffective && !isCurrent && <span className="text-xs text-emerald-700">Hérité à ce niveau</span>}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
