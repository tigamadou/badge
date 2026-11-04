"use client";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function FormSection({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-slate-100 py-6 first:pt-0 last:border-b-0">
      <h3 className="text-sm font-semibold text-navy">{title}</h3>
      {description ? <p className="mb-4 mt-1 text-[13px] text-slate-400">{description}</p> : <div className="mb-4" />}
      {children}
    </section>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={typeof label === "string" ? label : undefined}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 text-sm text-slate-600"
    >
      <span
        className={`relative h-[22px] w-[38px] flex-none rounded-full transition-colors ${
          checked ? "bg-navy" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </span>
      {label}
    </button>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
}) {
  return (
    <label className="inline-flex cursor-pointer items-start gap-2.5 text-sm text-slate-600">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-px flex h-4 w-4 flex-none items-center justify-center rounded border ${
          checked ? "border-navy bg-navy text-white" : "border-slate-300 bg-white"
        }`}
      >
        {checked ? <Icon name="check" size={12} /> : null}
      </button>
      {label}
    </label>
  );
}
