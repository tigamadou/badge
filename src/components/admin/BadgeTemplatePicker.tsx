"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Labels";
import { TemplatePreview } from "@/components/ui/TemplatePreview";
import { useAsyncAction } from "@/hooks/useAsyncAction";

export type TemplateSummary = {
  id: string;
  label: string;
  description: string;
  pages: number;
  pageSize: { width: string; height: string };
  previewSrc: string;
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
};

export default function BadgeTemplatePicker({
  templates,
  currentValue,
  effectiveId,
  effectiveLevel,
  patchUrl,
  canClearToInherit,
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
  const { pending } = save;

  return (
    <div className="space-y-5">
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
          >
            Utiliser le défaut hérité
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  {isCurrent && <Tag icon="check">Sélectionné</Tag>}
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Format {tpl.pageSize.width} × {tpl.pageSize.height} · {tpl.pages} page{tpl.pages > 1 ? "s" : ""}
                </p>
                <p className="mt-2 text-[13px] text-slate-600">{tpl.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => save.run(tpl.id)}
                  disabled={pending || isCurrent}
                  data-testid={`select-${tpl.id}`}
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
