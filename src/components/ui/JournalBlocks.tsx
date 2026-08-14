import type { ReactNode } from "react";

// Note DS : le fond `modification` utilise indigo-500/10 comme couleur de
// CATEGORIE de journal (pas comme accent d'action) — conforme a la contrainte
// "accent vert unique". Palette reprise de `.log-type` du template.
const LOG: Record<string, string> = {
  creation: "bg-emerald-50 text-emerald-700",
  modification: "bg-indigo-500/10 text-indigo-600",
  suppression: "bg-rose-50 text-rose-700",
  systeme: "bg-amber-50 text-amber-700",
  connexion: "bg-slate-100 text-slate-600",
  acces: "bg-brand-navy/10 text-brand-navy",
};

export function LogType({
  kind,
  children,
}: {
  kind: "creation" | "modification" | "suppression" | "systeme" | "connexion" | "acces";
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${LOG[kind]}`}
    >
      {children}
    </span>
  );
}

export function KeyValue({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-[160px_1fr]">
      {items.map((it, i) => (
        <div key={i} className="contents">
          <dt className="border-b border-slate-100 py-2.5 text-[13px] text-slate-400">{it.label}</dt>
          <dd className="border-b border-slate-100 py-2.5 text-sm text-slate-900">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Diff({ oldValue, newValue }: { oldValue: ReactNode; newValue: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px]">
        <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">Avant</div>
        {oldValue}
      </div>
      <span className="justify-self-center text-slate-400">&rarr;</span>
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px]">
        <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">Apres</div>
        {newValue}
      </div>
    </div>
  );
}

export function Payload({ json }: { json: string }) {
  return (
    <pre className="overflow-x-auto whitespace-pre rounded-[10px] bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-200">
      {json}
    </pre>
  );
}
