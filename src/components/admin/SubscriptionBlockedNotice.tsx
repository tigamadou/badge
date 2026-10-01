import Link from "next/link";
import { EmptyState } from "@/components/ui/Feedback";

// Ecran bloquant affiche a la place du contenu de l'espace organisation tant
// qu'aucun abonnement actif n'est attache. Seul l'onglet Abonnement reste
// consultable (le layout laisse passer /subscription).
export function SubscriptionBlockedNotice({ orgId }: { orgId: string }) {
  return (
    <EmptyState
      icon="alert-triangle"
      title="Abonnement inactif"
      description="Votre abonnement est inactif. Contactez le staff Badge pour le réactiver."
      action={
        <Link
          href={`/org/${orgId}/subscription`}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Voir mon abonnement
        </Link>
      }
    />
  );
}
