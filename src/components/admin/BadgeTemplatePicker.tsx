"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { Tag } from "@/components/ui/Labels";
import { Icon } from "@/components/ui/Icon";

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
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function patch(badgeTemplateId: string | null) {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch(patchUrl, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ badgeTemplateId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setMessage({
            type: "error",
            text: data?.error ?? "Echec de la sauvegarde.",
          });
          return;
        }
        setMessage({ type: "success", text: "Template enregistre." });
        router.refresh();
      } catch {
        setMessage({ type: "error", text: "Erreur reseau." });
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <p className="text-slate-600">
          Template effectif : <span className="font-mono text-slate-900">{effectiveId}</span>{" "}
          <span className="text-slate-400">(niveau {LEVEL_LABEL[effectiveLevel]})</span>
        </p>
        {canClearToInherit && currentValue !== null && (
          <button
            onClick={() => patch(null)}
            disabled={pending}
            className="text-sm font-medium text-green-600 hover:underline disabled:opacity-50"
          >
            Utiliser le défaut hérité
          </button>
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
                <Image
                  src={tpl.previewSrc}
                  alt={`Aperçu ${tpl.label}`}
                  width={400}
                  height={300}
                  className="object-contain"
                />
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
                  onClick={() => patch(tpl.id)}
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

      {message &&
        (message.type === "success" ? (
          <div data-testid="save-success">
            <Alert tone="success">
              <Icon name="check" size={16} /> {message.text}
            </Alert>
          </div>
        ) : (
          <div data-testid="save-error">
            <Alert tone="err">{message.text}</Alert>
          </div>
        ))}
    </div>
  );
}
