import Link from "next/link";
import { EmptyState } from "@/components/ui/Feedback";

// Ecran bloquant affiche a la place du contenu de l'espace organisation quand les
// droits de l'abonnement n'autorisent pas l'acces. L'onglet Abonnement et la liste
// des evenements restent consultables (le layout les laisse passer).
export function SubscriptionBlockedNotice({ orgId }: { orgId: string }) {
  return (
    <EmptyState
      icon="alert-triangle"
      title="Abonnement inactif"
      description="Votre abonnement est inactif. Pour le renouveler, rendez-vous dans l’onglet Abonnement. En cas de difficulté, contactez le support."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <a
            href="mailto:contact@badge.app"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-mist"
          >
            Contacter le support
          </a>
          <Link
            href={`/org/${orgId}/subscription`}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-hover"
          >
            Voir mon abonnement
          </Link>
        </div>
      }
    />
  );
}
