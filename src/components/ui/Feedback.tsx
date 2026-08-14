import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

const ALERT: Record<string, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-700",
  err: "border-rose-200 bg-rose-50 text-rose-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function Alert({ tone, children }: { tone: "info" | "err" | "warn" | "success"; children: ReactNode }) {
  return (
    <div role="alert" className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-[13px] ${ALERT[tone]}`}>
      {children}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-14 text-center">
      <span className="text-slate-300">
        <Icon name={icon} size={40} />
      </span>
      <div className="text-sm font-medium text-slate-900">{title}</div>
      {description ? <div className="max-w-sm text-[13px] text-slate-400">{description}</div> : null}
      {action}
    </div>
  );
}

export function Spinner({ size = 28 }: { size?: number }) {
  return (
    <span
      role="status"
      aria-label="Chargement"
      className="inline-block animate-spin rounded-full border-[3px] border-slate-200 border-t-green-600"
      style={{ width: size, height: size }}
    />
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div data-testid="progress-fill" className="h-full rounded-full bg-green-600" style={{ width: `${w}%` }} />
    </div>
  );
}

export function SuccessRing({ children }: { children: ReactNode }) {
  return (
    <span className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-emerald-50 text-green-600">
      {children}
    </span>
  );
}
