"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TableFrame } from "@/components/ui/TableFrame";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import {
  SUBSCRIPTION_RIGHTS,
  type RightsMatrix,
  type SubscriptionRight,
} from "@/lib/subscription-rights";

const LABELS: Record<SubscriptionRight, { title: string; hint: string }> = {
  CREATE_EVENT: { title: "Créer un évènement", hint: "Bouton de création, page et API." },
  RECEIVE_REGISTRATIONS: {
    title: "Recevoir des inscriptions",
    hint: "Inscriptions et re-soumissions. Sans abonnement : évènement en cours seulement.",
  },
  MANAGE_ONGOING_EVENTS: {
    title: "Gérer les évènements en cours",
    hint: "Actions d'écriture de l'espace évènement. Sans abonnement : évènement en cours seulement.",
  },
  ACCESS_ORG_SPACE: {
    title: "Accéder à l'espace organisation",
    hint: "Membres, réglages, modèles… L'onglet Abonnement et la liste des évènements restent accessibles.",
  },
};

export function SubscriptionRightsForm({
  initial,
  canManage,
}: {
  initial: RightsMatrix;
  canManage: boolean;
}) {
  const [rights, setRights] = useState<RightsMatrix>(initial);

  const save = useAsyncAction(
    async () => {
      const res = await fetch("/api/platform/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscriptionRights: rights }),
      });
      if (!res.ok) throw res;
    },
    { success: "Droits enregistrés.", error: "Erreur d'enregistrement." },
  );

  function toggle(right: SubscriptionRight, state: "active" | "inactive", value: boolean) {
    setRights((prev) => ({ ...prev, [right]: { ...prev[right], [state]: value } }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save.run();
      }}
      className="space-y-4"
    >
      <TableFrame className="border-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2">Droit</th>
              <th className="py-2 text-center">Abonnement actif</th>
              <th className="py-2 text-center">Abonnement inactif</th>
            </tr>
          </thead>
          <tbody>
            {SUBSCRIPTION_RIGHTS.map((right) => (
              <tr key={right} className="border-b border-slate-100">
                <td className="py-2">
                  <div className="font-medium text-slate-900">{LABELS[right].title}</div>
                  <div className="text-xs text-slate-400">{LABELS[right].hint}</div>
                </td>
                {(["active", "inactive"] as const).map((state) => (
                  <td key={state} className="py-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={`${LABELS[right].title} — ${state === "active" ? "abonnement actif" : "abonnement inactif"}`}
                      checked={rights[right][state]}
                      disabled={!canManage || save.pending}
                      onChange={(e) => toggle(right, state, e.target.checked)}
                      className="h-4 w-4 accent-navy"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
      {canManage ? (
        <Button type="submit" loading={save.pending}>
          Enregistrer
        </Button>
      ) : (
        <p className="text-xs text-slate-400">Modification réservée aux administrateurs du staff.</p>
      )}
    </form>
  );
}
