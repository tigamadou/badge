import { Alert } from "@/components/ui/Feedback";
import { counterView, type CounterTone } from "@/lib/print-requests/onsite-station-view";
import type { OnsiteCounter } from "@/lib/print-requests/onsite-counter";

const BAR: Record<CounterTone, string> = { ok: "bg-turquoise", warn: "bg-warn", err: "bg-rose-600" };

// Compteur de l'impression sur place : commandé, imprimé, plafond. Partagé staff / organisateur.
export function OnsiteCounterCard({ counter }: { counter: OnsiteCounter }) {
  const { summary, pct, tone, notice } = counterView(counter);
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4" data-testid="onsite-counter">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-base font-semibold tabular-nums text-slate-900">{summary}</span>
        <span className="text-xs text-slate-400">
          Plafond {counter.cap} · marge {counter.marginPercent} %
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-mist">
        <div className={`h-full rounded-full ${BAR[tone]}`} style={{ width: `${pct}%` }} />
      </div>
      {notice ? <Alert tone={tone === "err" ? "err" : "warn"}>{notice}</Alert> : null}
    </div>
  );
}
