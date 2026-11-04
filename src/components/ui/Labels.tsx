import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function CatPill({ color, label, count }: { color: string; label: ReactNode; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-900">
      <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: color }} />
      {label}
      {count != null ? <span className="text-[11px] tabular-nums text-slate-400">{count}</span> : null}
    </span>
  );
}

const ROLE: Record<string, string> = {
  green: "bg-turquoise-soft text-turquoise-strong",
  navy: "bg-navy/10 text-navy",
  amber: "bg-gold-soft text-gold-strong",
  warn: "bg-warn-soft text-warn",
  slate: "bg-mist text-slate-600",
};

export function RoleBadge({
  tone = "green",
  children,
}: {
  tone?: "green" | "navy" | "amber" | "warn" | "slate";
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${ROLE[tone]}`}
    >
      {children}
    </span>
  );
}

export function Tag({ icon, children }: { icon?: IconName; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-mist px-2 py-0.5 text-xs font-medium text-slate-600">
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}
