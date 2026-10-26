"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useAsyncAction } from "@/hooks/useAsyncAction";

function ActionButton({
  jobId,
  action,
  label,
  success,
  variant,
}: {
  jobId: string;
  action: "retry" | "cancel";
  label: string;
  success: string;
  variant: "primary" | "secondary";
}) {
  const router = useRouter();
  const { run, pending } = useAsyncAction(
    async () => {
      const res = await fetch(`/api/platform/jobs/${jobId}/${action}`, { method: "POST" });
      if (!res.ok) throw res;
    },
    { success, error: "Action impossible.", onSuccess: () => router.refresh() },
  );
  return (
    <Button variant={variant} loading={pending} onClick={run}>
      {label}
    </Button>
  );
}

export function JobActions({
  jobId,
  canRetry,
  canCancel,
}: {
  jobId: string;
  canRetry: boolean;
  canCancel: boolean;
}) {
  if (!canRetry && !canCancel) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {canRetry && (
        <ActionButton
          jobId={jobId}
          action="retry"
          label="Relancer"
          success="Email relancé."
          variant="primary"
        />
      )}
      {canCancel && (
        <ActionButton
          jobId={jobId}
          action="cancel"
          label="Annuler l'envoi"
          success="Envoi annulé."
          variant="secondary"
        />
      )}
    </div>
  );
}
