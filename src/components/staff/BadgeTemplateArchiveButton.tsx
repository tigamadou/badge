"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useAsyncAction } from "@/hooks/useAsyncAction";

export function BadgeTemplateArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const router = useRouter();

  // pending couvre la requête (le toast part ensuite) ; le refresh suit dans onSuccess.
  const toggle = useAsyncAction(
    async () => {
      const res = await fetch(`/api/platform/badge-templates/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archived: !archived }),
      });
      if (!res.ok) throw res;
    },
    {
      success: archived ? "Template restauré." : "Template archivé.",
      error: archived ? "Échec de la restauration." : "Échec de l'archivage.",
      onSuccess: () => router.refresh(),
    },
  );

  return (
    <Button variant="secondary" onClick={toggle.run} loading={toggle.pending}>
      <span className="inline-flex items-center gap-1.5">
        <Icon name={archived ? "check" : "archive"} size={15} />
        {archived ? "Restaurer" : "Archiver"}
      </span>
    </Button>
  );
}
