"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export function JournalEntryActions({ id, json }: { id: string; json: string }) {
  const [copied, setCopied] = useState(false);

  function copyId() {
    void navigator.clipboard?.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function exportJson() {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `journal-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={copyId} className="flex items-center gap-1.5">
        <Icon name="copy" size={14} /> {copied ? "Copié" : "Copier l'ID"}
      </Button>
      <Button variant="secondary" onClick={exportJson} className="flex items-center gap-1.5">
        <Icon name="download" size={14} /> Exporter JSON
      </Button>
    </div>
  );
}
