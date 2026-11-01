"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { RadioCards } from "@/components/ui/RadioCards";
import { Stepper } from "@/components/ui/Stepper";
import { useAsyncAction } from "@/hooks/useAsyncAction";

// Étape 1 de l'assistant : type de demande, puis création du brouillon et passage à l'édition.
export function NewPrintRequestForm({ orgId, eventId }: { orgId: string; eventId: string }) {
  const router = useRouter();
  const [type, setType] = useState<string | null>(null);
  const { run, pending } = useAsyncAction(
    async () => {
      const res = await fetch(`/api/org/${orgId}/events/${eventId}/print-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw res;
      return ((await res.json()) as { request: { id: string } }).request.id;
    },
    { onSuccess: (id) => router.push(`/event/${eventId}/print/${id}/edit`) },
  );

  return (
    <div>
      <Stepper steps={["Type", "Badges", "Support", "Accessoires", "Remise", "Récapitulatif"]} current={0} />
      <RadioCards
        name="Type de demande"
        options={[
          { value: "ADVANCE", title: "En amont", description: "Les badges sont imprimés avant l'évènement, pour les inscriptions choisies" },
          { value: "ONSITE", title: "Pendant l'évènement", description: "Impression sur place, pendant l'évènement" },
        ]}
        value={type}
        onChange={setType}
      />
      <div className="mt-8 flex justify-end">
        <Button type="button" disabled={!type} loading={pending} onClick={() => void run()}>
          Continuer
        </Button>
      </div>
    </div>
  );
}
