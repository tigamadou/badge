import Link from "next/link";
import { Alert, EmptyState } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { TableFrame } from "@/components/ui/TableFrame";
import {
  getJobCounts,
  listJobKinds,
  listJobs,
  parseJobListFilters,
} from "@/lib/jobs/admin";
import { JOB_STATUS_LABELS, JobStatusBadge } from "./_components/JobStatusBadge";
import { UrlPagination } from "@/components/ui/Pagination";

const FIELD_CLASS =
  "block rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-700";
const ERROR_MAX = 80;

function truncate(text: string): string {
  return text.length > ERROR_MAX ? `${text.slice(0, ERROR_MAX)}…` : text;
}

export default async function PlatformJobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (v ? [[k, v] as [string, string]] : [])),
  );
  let parsed = parseJobListFilters(params);
  const invalidStatus = !parsed.ok;
  if (!parsed.ok) {
    params.delete("status");
    parsed = parseJobListFilters(params);
  }
  // Sans statut, le second appel ne peut pas echouer.
  const filters = parsed.ok ? parsed.filters : { page: 1, pageSize: 10 };

  const [{ jobs, total, page, pageSize }, kinds, counts] = await Promise.all([
    listJobs(filters),
    listJobKinds(),
    getJobCounts(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-navy">Emails</h1>
        <p className="mt-0.5 text-sm text-slate-400">File d&apos;envoi des emails de la plateforme</p>
      </div>

      <StatGrid cols={3}>
        <StatCard label="En attente" value={counts.pending} icon="clock" />
        <StatCard label="En échec" value={counts.failed} icon="alert-triangle" />
        <StatCard label="Envoyés (24 h)" value={counts.sentLast24h} icon="send" />
      </StatGrid>

      {invalidStatus && <Alert tone="warn">Statut inconnu : filtre ignoré.</Alert>}

      <form method="get" className="flex flex-wrap items-end gap-2.5">
        <input type="hidden" name="pageSize" value={pageSize} />
        <label className="text-[13px] text-slate-500">
          <div className="mb-1">Statut</div>
          <select name="status" defaultValue={filters.status ?? ""} className={FIELD_CLASS}>
            <option value="">Tous</option>
            {Object.entries(JOB_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[13px] text-slate-500">
          <div className="mb-1">Type</div>
          <select name="kind" defaultValue={filters.kind ?? ""} className={FIELD_CLASS}>
            <option value="">Tous</option>
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[13px] text-slate-500">
          <div className="mb-1">Du</div>
          <input type="date" name="from" defaultValue={sp.from ?? ""} className={FIELD_CLASS} />
        </label>
        <label className="text-[13px] text-slate-500">
          <div className="mb-1">Au</div>
          <input type="date" name="to" defaultValue={sp.to ?? ""} className={FIELD_CLASS} />
        </label>
        <label className="text-[13px] text-slate-500">
          <div className="mb-1">Destinataire</div>
          <input name="q" defaultValue={filters.q ?? ""} className={FIELD_CLASS} />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-mist px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Filtrer
        </button>
      </form>

      {jobs.length === 0 ? (
        <TableFrame>
          <EmptyState icon="mail" title="Aucun email" />
        </TableFrame>
      ) : (
        <TableFrame>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                <th className="px-4 py-3">Date</th>
                <th className="hidden px-4 py-3 md:table-cell">Type</th>
                <th className="px-4 py-3">Destinataire</th>
                <th className="px-4 py-3">Statut</th>
                <th className="hidden px-4 py-3 md:table-cell">Tentatives</th>
                <th className="hidden px-4 py-3 md:table-cell">Dernière erreur</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-slate-100 hover:bg-mist">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-400">
                    {job.createdAt.toLocaleString("fr-FR")}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-slate-500 md:table-cell">
                    {job.kind}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-slate-600">{job.recipient ?? "—"}</td>
                  <td className="px-4 py-3">
                    <JobStatusBadge status={job.status} />
                  </td>
                  <td className="hidden px-4 py-3 tabular-nums text-slate-600 md:table-cell">
                    {job.attempts}/{job.maxAttempts}
                  </td>
                  <td
                    className="hidden px-4 py-3 text-xs text-slate-400 md:table-cell"
                    title={job.lastError ?? undefined}
                  >
                    {job.lastError ? truncate(job.lastError) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/platform/jobs/${job.id}`}
                      aria-label="Voir le détail"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-mist hover:text-slate-600"
                    >
                      <Icon name="chevron-right" size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableFrame>
      )}

      <UrlPagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} />
    </div>
  );
}
