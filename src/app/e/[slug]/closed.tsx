type Props = { reason: "NOT_FOUND" | "CLOSED" };

export function ClosedView({ reason }: Props) {
  return (
    <div className="rounded-lg border bg-white p-6 text-center">
      <h2 className="text-xl font-semibold text-neutral-900">
        {reason === "NOT_FOUND" ? "Événement introuvable" : "Inscriptions fermées"}
      </h2>
      <p className="mt-2 text-sm text-neutral-600">
        {reason === "NOT_FOUND"
          ? "Le lien suivi ne correspond à aucun événement."
          : "Les inscriptions à cet événement ne sont pas (ou plus) ouvertes."}
      </p>
    </div>
  );
}
