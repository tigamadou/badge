"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export function BadgeTemplateArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function toggle() {
    setError(null);
    const res = await fetch(`/api/platform/badge-templates/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archived: !archived }),
    });
    if (!res.ok) {
      setError(archived ? "Échec de la restauration." : "Échec de l'archivage.");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={toggle} disabled={pending} className="flex items-center gap-1.5">
        <Icon name={archived ? "check" : "archive"} size={15} />
        {archived ? "Restaurer" : "Archiver"}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
