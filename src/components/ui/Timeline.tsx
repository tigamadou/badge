import type { ReactNode } from "react";

const DOT: Record<string, string> = {
  default: "border-slate-300 bg-white",
  ok: "border-green-600 bg-green-600",
  warn: "border-amber-700 bg-white",
  danger: "border-rose-600 bg-white",
};

export function Timeline({ children }: { children: ReactNode }) {
  return (
    <div className="relative pl-[26px] before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-0.5 before:bg-slate-200">
      {children}
    </div>
  );
}

export function TimelineItem({
  tone = "default",
  title,
  meta,
}: {
  tone?: "default" | "ok" | "warn" | "danger";
  title: ReactNode;
  meta: ReactNode;
}) {
  return (
    <div className="relative pb-5 last:pb-0">
      <span className={`absolute -left-[26px] top-0.5 h-4 w-4 rounded-full border-2 ${DOT[tone]}`} />
      <div className="text-sm font-medium text-slate-900">{title}</div>
      <div className="mt-0.5 text-xs text-slate-400">{meta}</div>
    </div>
  );
}
