import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function VerifyBanner({ valid, title, children }: { valid: boolean; title: ReactNode; children?: ReactNode }) {
  return (
    <div className={`rounded-2xl px-6 py-7 text-center ${valid ? "bg-turquoise text-navy" : "bg-rose-600 text-white"}`}>
      <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
        <Icon name={valid ? "shield-check" : "shield-x"} size={26} />
      </span>
      <div className="text-2xl font-bold">{title}</div>
      {children}
    </div>
  );
}

export function PhoneMockup({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[420px] sm:w-[360px] sm:overflow-hidden sm:rounded-[40px] sm:border-[10px] sm:border-slate-900">
      <div className="bg-mist">{children}</div>
    </div>
  );
}
