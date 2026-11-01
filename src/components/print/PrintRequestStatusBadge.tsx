import type { PrintRequestStatus } from "@prisma/client";
import { PRINT_REQUEST_STATUS_LABELS } from "@/lib/print-requests/labels";

// Tons par statut ; mêmes classes que StatusBadge / GenerationList.
const TONE: Record<PrintRequestStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-amber-50 text-amber-700",
  QUOTED: "bg-sky-50 text-sky-700",
  ACCEPTED: "bg-blue-50 text-blue-700",
  PAID: "bg-emerald-50 text-emerald-700",
  IN_PRODUCTION: "bg-indigo-50 text-indigo-700",
  READY: "bg-teal-50 text-teal-700",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-50 text-rose-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export function PrintRequestStatusBadge({ status }: { status: PrintRequestStatus }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${TONE[status]}`}>
      {PRINT_REQUEST_STATUS_LABELS[status]}
    </span>
  );
}
