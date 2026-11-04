import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function StatGrid({ cols, children }: { cols: 3 | 4 | 5; children: ReactNode }) {
  const colClass = cols === 5 ? "lg:grid-cols-5" : cols === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";
  return <div className={`grid grid-cols-2 gap-4 ${colClass}`}>{children}</div>;
}

export function StatCard({
  label,
  value,
  icon,
  sub,
  delta,
}: {
  label: string;
  value: ReactNode;
  icon: IconName;
  sub?: ReactNode;
  delta?: { dir: "up" | "down"; text: string };
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mist text-slate-500">
          <Icon name={icon} size={18} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {delta || sub ? (
        <p className="mt-1 text-[13px] text-slate-400">
          {delta ? (
            <span
              className={`mr-1 inline-flex items-center gap-1 font-medium ${
                delta.dir === "up" ? "text-turquoise-strong" : "text-rose-700"
              }`}
            >
              <Icon name={delta.dir === "up" ? "trending-up" : "trending-down"} size={12} />
              {delta.text}
            </span>
          ) : null}
          {sub}
        </p>
      ) : null}
    </div>
  );
}
