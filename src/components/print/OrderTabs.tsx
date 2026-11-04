"use client";

import { useState, type ReactNode } from "react";

export interface OrderTab {
  id: string;
  label: string;
  panel: ReactNode;
}

// Onglets de la page commande sous `xl` (conversation / devis / détails) : un seul panneau monté.
// Au-delà, les colonnes sont affichées côte à côte par le conteneur de la page.
export function OrderTabs({ tabs, defaultId }: { tabs: OrderTab[]; defaultId: string }) {
  const [active, setActive] = useState(defaultId);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div className="flex min-h-0 flex-1 flex-col xl:hidden">
      <div role="tablist" className="flex flex-none border-b border-slate-200 bg-white">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`order-tab-${tab.id}`}
            aria-selected={tab.id === current.id}
            aria-controls={`order-panel-${tab.id}`}
            onClick={() => setActive(tab.id)}
            className={`flex-1 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              tab.id === current.id ? "border-green-600 text-green-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`order-panel-${current.id}`}
        aria-labelledby={`order-tab-${current.id}`}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        {current.panel}
      </div>
    </div>
  );
}
