import type { ReactNode } from "react";
import { Icon } from "../ui/Icon";

// Vignette compacte pour la grille d'impression batch (`event-badge-batch.html`).
export function MiniBadge({
  name,
  category,
  categoryColor,
  state,
}: {
  name: ReactNode;
  category: ReactNode;
  categoryColor: string;
  state: "pending" | "generating" | "done";
}) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="h-1.5" style={{ background: categoryColor }} />
      <div className="p-3">
        <div className="truncate text-xs font-semibold text-slate-900">{name}</div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className="h-2 w-2 flex-none rounded-[3px]" style={{ background: categoryColor }} />
          {category}
        </div>
      </div>
      <span className="absolute right-2 top-2">
        {state === "done" ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-turquoise text-navy">
            <Icon name="check" size={12} />
          </span>
        ) : state === "generating" ? (
          <span
            role="status"
            aria-label="Generation"
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-navy"
          />
        ) : null}
      </span>
    </div>
  );
}
