import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function BatchBar({ count, children }: { count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 sm:gap-3 rounded-lg bg-brand-navy px-4 py-2.5 text-sm text-white">
      <span className="w-full font-semibold tabular-nums sm:w-auto">{count} sélectionnée(s)</span>
      <span className="hidden flex-1 sm:block" />
      {children}
    </div>
  );
}

export function BatchButton({
  icon,
  children,
  onClick,
  loading = false,
}: {
  icon?: IconName;
  children: ReactNode;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      aria-busy={loading || undefined}
      className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.14] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/[0.24] disabled:opacity-60"
    >
      {loading ? (
        <span
          aria-hidden="true"
          data-testid="button-spinner"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : icon ? (
        <Icon name={icon} size={14} />
      ) : null}
      {children}
    </button>
  );
}
