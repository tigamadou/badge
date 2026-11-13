import { EmptyState } from "@/components/ui/Feedback";

// Page d'attente : le contenu de la documentation arrive avec le lot 4a.
export default function AccountDocsPage() {
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-navy">Documentation</h1>
      <EmptyState
        icon="file"
        title="Bientôt disponible"
        description="La documentation de cet espace arrive prochainement."
      />
    </div>
  );
}
