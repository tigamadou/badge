type Status = "PENDING" | "APPROVED" | "REJECTED";

const statusConfig: Record<Status, { label: string; className: string }> = {
  PENDING: { label: "En attente", className: "bg-amber-50 text-amber-700" },
  APPROVED: { label: "Validé", className: "bg-emerald-50 text-emerald-700" },
  REJECTED: { label: "Rejeté", className: "bg-rose-50 text-rose-700" },
};

export function StatusBadge({ status }: { status: Status }) {
  const config = statusConfig[status];
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
