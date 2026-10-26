"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { RadioCards } from "@/components/ui/RadioCards";
import { useAsyncAction } from "@/hooks/useAsyncAction";

export type ResubmitCategory = { id: string; name: string; color: string };

export default function ResubmitButton({
  registrationId,
  currentCategoryId,
  categories,
}: {
  registrationId: string;
  currentCategoryId: string;
  categories: ResubmitCategory[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentCategoryId);
  const changed = selected !== currentCategoryId;
  const selectedName = categories.find((c) => c.id === selected)?.name;

  const { run, pending } = useAsyncAction(
    async () => {
      const res = await fetch(`/api/account/registrations/${registrationId}/resubmit`, {
        method: "POST",
        // Corps uniquement si la categorie change : sinon comportement historique.
        ...(changed
          ? {
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ categoryId: selected }),
            }
          : {}),
      });
      if (!res.ok) throw res;
      return (await res.json()).id as string;
    },
    {
      success: "Inscription resoumise.",
      error: "Resoumission impossible.",
      // L'ID change avec la categorie : l'ancienne URL renverrait une 404.
      onSuccess: (id) =>
        id !== registrationId
          ? router.replace(`/account/registrations/${encodeURIComponent(id)}`)
          : router.refresh(),
    },
  );

  return (
    <div className="w-full space-y-3">
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-900">Catégorie</p>
        <RadioCards
          name="Catégorie"
          options={categories.map((c) => ({ value: c.id, title: c.name, color: c.color }))}
          value={selected}
          onChange={setSelected}
        />
        {changed && (
          <p className="text-sm text-slate-600">
            Votre inscription sera resoumise dans la catégorie <em>{selectedName}</em>.
          </p>
        )}
      </div>
      <Button onClick={run} loading={pending}>
        Resoumettre mon inscription
      </Button>
    </div>
  );
}
