import type { ReactNode } from "react";

function fillTone(pct: number) {
  if (pct >= 90) return "bg-rose-600";
  if (pct >= 75) return "bg-warn";
  return "bg-turquoise";
}

export function QuotaBar({ label, valueText, pct }: { label: ReactNode; valueText: ReactNode; pct: number }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="my-3.5">
      <div className="mb-1.5 flex justify-between text-[13px]">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium tabular-nums text-slate-900">{valueText}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-mist">
        <div data-testid="quota-fill" className={`h-full rounded-full ${fillTone(pct)}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

export function StorageAlert({ pct, children }: { pct: number; children: ReactNode }) {
  if (pct < 75) return null;
  return (
    <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-warn/20 bg-warn-soft px-4 py-3 text-[13px] font-medium text-warn">
      {children}
    </div>
  );
}
