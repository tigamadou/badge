import type { PrintRequestStatus } from "@prisma/client";
import { PRINT_REQUEST_STATUS_LABELS } from "@/lib/print-requests/labels";

// Tons par statut ; mêmes classes que StatusBadge / GenerationList.
const TONE: Record<PrintRequestStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-gold-soft text-gold-strong",
  QUOTED: "bg-mist text-navy",
  ACCEPTED: "bg-mist text-navy",
  PAID: "bg-turquoise-soft text-turquoise-strong",
  IN_PRODUCTION: "bg-mist text-navy",
  READY: "bg-turquoise-soft text-turquoise-strong",
  COMPLETED: "bg-turquoise-soft text-turquoise-strong",
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
