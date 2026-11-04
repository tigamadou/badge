import Link from "next/link";
import type { ReactNode } from "react";

// Variante de Tabs pilotee par l'URL : chaque onglet est un lien, utilisable
// depuis un Server Component.
export function TabLinks({
  tabs,
  value,
  label,
}: {
  tabs: { value: string; label: ReactNode; href: string }[];
  value: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="mb-6 flex gap-1 overflow-x-auto whitespace-nowrap border-b border-slate-200">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <Link
            key={t.value}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`-mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-sm font-medium ${
              on ? "border-navy text-navy" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
