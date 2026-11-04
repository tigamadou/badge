"use client";
import type { ReactNode } from "react";

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: string; label: ReactNode }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div role="tablist" className="mb-6 flex gap-1 overflow-x-auto whitespace-nowrap border-b border-slate-200">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={`-mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-sm font-medium ${
              on ? "border-navy text-navy" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: ReactNode }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex gap-0.5 rounded-[9px] bg-mist p-[3px]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-md px-3.5 py-1.5 text-[13px] font-medium ${
              on ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
