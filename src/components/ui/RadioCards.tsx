"use client";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function RadioCards({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: string; title: ReactNode; description?: ReactNode; color?: string; disabled?: boolean }[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <button
            type="button"
            role="radio"
            aria-checked={sel}
            key={o.value}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={`relative flex items-start gap-3 rounded-xl border-[1.5px] p-4 text-left transition-colors ${
              o.disabled
                ? "cursor-not-allowed border-slate-200 bg-mist opacity-60"
                : sel
                  ? "border-navy bg-mist"
                  : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            {o.color ? <span className="mt-0.5 h-3.5 w-3.5 flex-none rounded" style={{ background: o.color }} /> : null}
            <span>
              <span className="block text-sm font-semibold text-navy">{o.title}</span>
              {o.description ? (
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">{o.description}</span>
              ) : null}
            </span>
            {sel ? (
              <span className="absolute right-3 top-3 text-navy">
                <Icon name="check" size={16} />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
