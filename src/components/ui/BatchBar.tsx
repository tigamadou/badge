import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function BatchBar({ count, children }: { count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="mb-3 flex items-center gap-3 rounded-lg bg-brand-navy px-4 py-2.5 text-sm text-white">
      <span className="font-semibold tabular-nums">{count} selectionnee(s)</span>
      <span className="flex-1" />
      {children}
    </div>
  );
}

export function BatchButton({
  icon,
  children,
  onClick,
}: {
  icon?: IconName;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.14] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/[0.24]"
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </button>
  );
}
