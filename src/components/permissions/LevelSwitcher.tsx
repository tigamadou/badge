"use client";

import { useState, type ReactNode } from "react";
import { Tabs } from "@/components/ui/Tabs";

type Item = { value: string; label: string; content: ReactNode };

// Bascule entre niveaux (plateforme, organisations) ; les niveaux masqués restent montés et gardent leur saisie.
export function LevelSwitcher({ items }: { items: Item[] }) {
  const [current, setCurrent] = useState(items[0]?.value ?? "");
  if (items.length < 2) return <>{items[0]?.content}</>;
  return (
    <div>
      <Tabs tabs={items.map(({ value, label }) => ({ value, label }))} value={current} onChange={setCurrent} />
      {items.map((item) => (
        <div key={item.value} hidden={item.value !== current}>
          {item.content}
        </div>
      ))}
    </div>
  );
}
