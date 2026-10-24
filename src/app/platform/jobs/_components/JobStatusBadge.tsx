import type { JobStatus } from "@prisma/client";

const STATUS: Record<JobStatus, { label: string; tone: string }> = {
  PENDING: { label: "En attente", tone: "bg-amber-50 text-amber-700" },
  RUNNING: { label: "En cours", tone: "bg-blue-50 text-blue-700" },
  SUCCEEDED: { label: "Envoyé", tone: "bg-emerald-50 text-emerald-700" },
  FAILED: { label: "En échec", tone: "bg-rose-50 text-rose-700" },
  CANCELLED: { label: "Annulé", tone: "bg-slate-100 text-slate-600" },
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const { label, tone } = STATUS[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  PENDING: STATUS.PENDING.label,
  RUNNING: STATUS.RUNNING.label,
  SUCCEEDED: STATUS.SUCCEEDED.label,
  FAILED: STATUS.FAILED.label,
  CANCELLED: STATUS.CANCELLED.label,
};
