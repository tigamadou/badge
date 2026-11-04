import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

// Bouton « Créer un événement » de la liste. Sans le droit, il est désactivé et une
// explication adaptée à la cause (abonnement inactif ou réglage de la plateforme) le suit.
export function CreateEventButton({
  orgId,
  canCreate,
  subscriptionActive,
}: {
  orgId: string;
  canCreate: boolean;
  subscriptionActive: boolean;
}) {
  if (canCreate) {
    return (
      <Link
        href={`/org/${orgId}/events/new`}
        className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-sm font-medium text-white hover:bg-navy-hover"
      >
        <Icon name="plus" size={16} /> Créer un événement
      </Link>
    );
  }
  const hintId = "create-event-disabled-hint";
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-describedby={hintId}
        className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-slate-200 px-3.5 py-2 text-sm font-medium text-slate-500"
      >
        <Icon name="plus" size={16} /> Créer un événement
      </button>
      <p id={hintId} className="text-xs text-slate-500">
        {subscriptionActive ? (
          "La création d’événement n’est pas disponible avec votre abonnement."
        ) : (
          <>
            Abonnement inactif : la création d’événement est désactivée.{" "}
            <Link href={`/org/${orgId}/subscription`} className="font-medium text-navy hover:underline">
              Voir mon abonnement
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
