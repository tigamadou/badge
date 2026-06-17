"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

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
      <div className="rounded-md border border-gray-200 bg-white p-3 text-sm">
        <p>
          <strong>Template effectif :</strong> {effectiveId}{" "}
          <span className="text-gray-500">(niveau {LEVEL_LABEL[effectiveLevel]})</span>
        </p>
        {canClearToInherit && currentValue !== null && (
          <button
            onClick={() => patch(null)}
            disabled={pending}
            className="mt-2 text-sm text-indigo-700 underline disabled:opacity-50"
          >
            Utiliser le defaut herite
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((tpl) => {
          const isCurrent = currentValue === tpl.id;
          const isEffective = effectiveId === tpl.id;
          return (
            <div
              key={tpl.id}
              data-testid={`template-card-${tpl.id}`}
              data-selected={isCurrent ? "true" : "false"}
              className={`rounded-lg border p-4 bg-white space-y-3 ${
                isCurrent ? "border-indigo-500 ring-2 ring-indigo-200" : "border-gray-200"
              }`}
            >
              <div className="aspect-[4/3] bg-gray-50 rounded overflow-hidden flex items-center justify-center">
                <Image
                  src={tpl.previewSrc}
                  alt={`Apercu ${tpl.label}`}
                  width={400}
                  height={300}
                  className="object-contain"
                />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{tpl.label}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Format {tpl.pageSize.width} x {tpl.pageSize.height} -- {tpl.pages}{" "}
                  page{tpl.pages > 1 ? "s" : ""}
                </p>
                <p className="text-sm text-gray-700 mt-2">{tpl.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => patch(tpl.id)}
                  disabled={pending || isCurrent}
                  data-testid={`select-${tpl.id}`}
                  className="bg-indigo-600 text-white px-4 py-1.5 rounded text-sm font-semibold disabled:opacity-50"
                >
                  {isCurrent ? "Selectionne" : "Selectionner"}
                </button>
                {isEffective && !isCurrent && (
                  <span className="text-xs text-emerald-700">Herite a ce niveau</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {message && (
        <p
          className={`text-sm ${
            message.type === "success" ? "text-emerald-700" : "text-rose-600"
          }`}
          data-testid={message.type === "success" ? "save-success" : "save-error"}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
