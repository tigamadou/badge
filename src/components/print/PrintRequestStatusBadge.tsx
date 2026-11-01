import type { PrintRequestStatus } from "@prisma/client";
import { PRINT_REQUEST_STATUS_LABELS } from "@/lib/print-requests/labels";

const TONES: Record<PrintRequestStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-blue-50 text-blue-700",
  QUOTED: "bg-amber-50 text-amber-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
  PAID: "bg-emerald-50 text-emerald-700",
  IN_PRODUCTION: "bg-blue-50 text-blue-700",
  READY: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-green-100 text-green-700",
  REJECTED: "bg-rose-50 text-rose-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

// Pastille de statut d'une demande d'impression (libellés de PRINT_REQUEST_STATUS_LABELS).
export function PrintRequestStatusBadge({ status }: { status: PrintRequestStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${TONES[status]}`}>
      {PRINT_REQUEST_STATUS_LABELS[status]}
    </span>
  );
}
