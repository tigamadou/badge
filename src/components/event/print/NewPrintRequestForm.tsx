"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { RadioCards } from "@/components/ui/RadioCards";
import { Stepper } from "@/components/ui/Stepper";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { ONSITE_NOT_ELIGIBLE_MESSAGE, onsiteOptionState, type OnsiteEligibilityState } from "./onsite-option";

// Étape 1 de l'assistant : type de demande, puis création du brouillon et passage à l'édition.
export function NewPrintRequestForm({ orgId, eventId }: { orgId: string; eventId: string }) {
  const router = useRouter();
  const [type, setType] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<OnsiteEligibilityState>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/org/${orgId}/events/${eventId}/print-requests/onsite-eligibility`)
      .then(async (res) => {
        if (!res.ok) throw res;
        return (await res.json()) as { eligible: boolean };
      })
      .then((d) => !cancelled && setEligibility({ status: "ready", eligible: d.eligible }))
      .catch(() => !cancelled && setEligibility({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [orgId, eventId]);
  const onsite = onsiteOptionState(eligibility);
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
          { value: "ONSITE", title: "Pendant l'évènement", description: "Impression sur place, pendant l'évènement", disabled: onsite.disabled },
        ]}
        value={type}
        onChange={setType}
      />
      {onsite.showNotice ? (
        <p className="mt-3 text-sm text-amber-700">
          {ONSITE_NOT_ELIGIBLE_MESSAGE}{" "}
          <Link href={`/event/${eventId}/settings/badge`} className="font-medium underline">
            Changer le modèle de badge
          </Link>
        </p>
      ) : null}
      <div className="mt-8 flex justify-end">
        <Button type="button" disabled={!type || (type === "ONSITE" && onsite.disabled)} loading={pending} onClick={() => void run()}>
          Continuer
        </Button>
      </div>
    </div>
  );
}
