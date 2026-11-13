import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformPage } from "@/app/platform/page-guard";
import { getJobDetail } from "@/lib/jobs/admin";
import { Card, CardBody, CardHead } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";
import { KeyValue } from "@/components/ui/JournalBlocks";
import { JobActions } from "../_components/JobActions";
import { JobStatusBadge } from "../_components/JobStatusBadge";

const fmt = (d: Date | null) => (d ? d.toLocaleString("fr-FR") : "—");

export default async function PlatformJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const { permissions } = await requirePlatformPage("email_jobs.read", `/platform/jobs/${jobId}`);
  const job = await getJobDetail(jobId);
  if (!job) notFound();

  const canAdmin = permissions.has("email_jobs.manage");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/platform/jobs"
          className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-700"
        >
          <Icon name="arrow-left" size={14} /> Emails
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-navy">{job.subject ?? job.kind}</h1>
      </div>

      <Card>
        <CardHead
          title="Détail de l'envoi"
          action={
            canAdmin ? (
              <JobActions jobId={job.id} canRetry={job.canRetry} canCancel={job.canCancel} />
            ) : undefined
          }
        />
        <CardBody>
          <KeyValue
            items={[
              { label: "Statut", value: <JobStatusBadge status={job.status} /> },
              { label: "Type", value: <span className="font-mono text-xs">{job.kind}</span> },
              { label: "Destinataire", value: job.recipient ?? "—" },
              { label: "Sujet", value: job.subject ?? "—" },
              { label: "Priorité", value: job.priority >= 10 ? "Haute" : "Normale" },
              { label: "Tentatives", value: `${job.attempts}/${job.maxAttempts}` },
              { label: "Prochain essai", value: fmt(job.runAt) },
              { label: "Créé le", value: fmt(job.createdAt) },
              { label: "Terminé le", value: fmt(job.completedAt) },
              ...(job.status === "RUNNING"
                ? [{ label: "Verrou", value: `${job.lockedBy ?? "—"} (${fmt(job.lockedAt)})` }]
                : []),
            ]}
          />
        </CardBody>
      </Card>

      {job.lastError && (
        <Card>
          <CardHead title="Dernière erreur" />
          <CardBody>
            <pre className="whitespace-pre-wrap break-words text-xs text-rose-700">{job.lastError}</pre>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHead title="Contenu" />
        <CardBody>
          {job.sensitive ? (
            <Alert tone="info">
              Contenu masqué : cet email contient un lien à usage unique.
            </Alert>
          ) : job.previewHtml === null ? (
            <p className="text-sm text-slate-400">Contenu purgé après envoi.</p>
          ) : (
            <iframe
              sandbox=""
              srcDoc={job.previewHtml}
              title="Aperçu de l'email"
              className="h-[60vh] w-full rounded-lg border border-slate-200"
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
