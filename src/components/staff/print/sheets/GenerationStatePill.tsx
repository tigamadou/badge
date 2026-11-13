import { Spinner } from "@/components/ui/Feedback";

export type GenerationState = "PENDING" | "RUNNING" | "DONE" | "FAILED";

const STYLE: Record<GenerationState, string> = {
  PENDING: "bg-gold-soft text-gold-strong",
  RUNNING: "bg-mist text-navy",
  DONE: "bg-turquoise-soft text-turquoise-strong",
  FAILED: "bg-rose-50 text-rose-700",
};

// État d'une génération de planche : spinner tant qu'elle est en attente ou en cours, message d'échec sinon.
export function GenerationStatePill({
  status,
  doneLabel,
  error,
}: {
  status: GenerationState;
  doneLabel: string;
  error?: string | null;
}) {
  const label =
    status === "PENDING" ? "En attente…" : status === "RUNNING" ? "Génération en cours…" : status === "DONE" ? doneLabel : "Échec";
  return (
    <div className="space-y-1">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${STYLE[status]}`}>
        {(status === "PENDING" || status === "RUNNING") && <Spinner size={12} />}
        {label}
      </span>
      {status === "FAILED" && <p className="text-xs text-rose-600">{error ?? "Erreur inconnue."}</p>}
    </div>
  );
}
