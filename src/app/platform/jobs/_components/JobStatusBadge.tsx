import type { JobStatus } from "@prisma/client";

const STATUS: Record<JobStatus, { label: string; tone: string }> = {
  PENDING: { label: "En attente", tone: "bg-gold-soft text-gold-strong" },
  RUNNING: { label: "En cours", tone: "bg-mist text-navy" },
  SUCCEEDED: { label: "Envoyé", tone: "bg-turquoise-soft text-turquoise-strong" },
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
