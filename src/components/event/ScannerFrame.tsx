import type { ReactNode } from "react";
import { Icon } from "../ui/Icon";

// Habillage visuel du scanner (cadre sombre + reticule vert + laser). Le flux
// camera (html5-qrcode, gere par QRScanner) est passe en `children`.
export function ScannerFrame({ children }: { children?: ReactNode }) {
  return (
    <div className="relative mx-auto flex aspect-[3/4] max-w-[360px] items-center justify-center overflow-hidden rounded-2xl bg-slate-900">
      {children}
      <div className="relative aspect-square w-[62%]">
        <span className="absolute left-0 top-0 h-[30px] w-[30px] rounded-tl-xl border-l-[3px] border-t-[3px] border-green-400" />
        <span className="absolute right-0 top-0 h-[30px] w-[30px] rounded-tr-xl border-r-[3px] border-t-[3px] border-green-400" />
        <span className="absolute bottom-0 left-0 h-[30px] w-[30px] rounded-bl-xl border-b-[3px] border-l-[3px] border-green-400" />
        <span className="absolute bottom-0 right-0 h-[30px] w-[30px] rounded-br-xl border-b-[3px] border-r-[3px] border-green-400" />
      </div>
      <span className="absolute left-[8%] right-[8%] top-1/2 h-0.5 bg-green-400 shadow-[0_0_12px] shadow-green-400" />
    </div>
  );
}

export function ScanResult({ valid, title, children }: { valid: boolean; title: ReactNode; children?: ReactNode }) {
  return (
    <div className={`rounded-2xl border p-6 text-center ${valid ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
      <span
        className={`inline-flex h-14 w-14 items-center justify-center rounded-full text-white ${
          valid ? "bg-green-600" : "bg-rose-600"
        }`}
      >
        <Icon name={valid ? "check" : "x"} size={26} />
      </span>
      <div className={`mb-0.5 mt-3 text-lg font-bold ${valid ? "text-emerald-700" : "text-rose-700"}`}>{title}</div>
      {children}
    </div>
  );
}
