type Status = "PENDING" | "APPROVED" | "REJECTED";

const statusConfig: Record<Status, { label: string; className: string }> = {
  PENDING: { label: "En attente", className: "bg-yellow-100 text-yellow-800" },
  APPROVED: { label: "Validé", className: "bg-green-100 text-green-800" },
  REJECTED: { label: "Rejeté", className: "bg-red-100 text-red-800" },
};

export function StatusBadge({ status }: { status: Status }) {
  const config = statusConfig[status];
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
