import type { Job, JobStatus, JobType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseListPage } from "@/lib/list-query";
import { paginate } from "@/lib/paginate";
import { isSensitiveEmailKind } from "./email-kinds";
import { parseEmailPayload } from "./email-payload";

const DAY_MS = 24 * 3_600_000;
const JOB_STATUSES: readonly JobStatus[] = ["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"];
const RETRYABLE: JobStatus[] = ["FAILED", "CANCELLED"];

export type JobListFilters = {
  status?: JobStatus;
  kind?: string;
  from?: Date;
  to?: Date;
  q?: string;
  page: number;
  pageSize: number;
};

// Jour AAAA-MM-JJ (UTC) ou undefined si absent / invalide.
function parseDay(raw: string | null): Date | undefined {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function parseJobListFilters(
  params: URLSearchParams,
): { ok: true; filters: JobListFilters } | { ok: false; code: "INVALID_STATUS" } {
  const status = params.get("status");
  if (status && !JOB_STATUSES.includes(status as JobStatus)) {
    return { ok: false, code: "INVALID_STATUS" };
  }
  const { page, pageSize } = parseListPage(params);
  const lastDay = parseDay(params.get("to"));
  const filters: JobListFilters = {
    page,
    pageSize,
  };
  if (status) filters.status = status as JobStatus;
  const kind = params.get("kind");
  if (kind) filters.kind = kind;
  const from = parseDay(params.get("from"));
  if (from) filters.from = from;
  // `to` est une borne exclusive : le jour choisi est inclus.
  if (lastDay) filters.to = new Date(lastDay.getTime() + DAY_MS);
  const q = params.get("q")?.trim();
  if (q) filters.q = q;
  return { ok: true, filters };
}

export type JobListItem = {
  id: string;
  type: JobType;
  kind: string;
  recipient: string | null;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: Date;
  runAt: Date;
  completedAt: Date | null;
};

// `payload` n'est jamais selectionne dans la liste.
const LIST_SELECT = {
  id: true,
  type: true,
  kind: true,
  recipient: true,
  status: true,
  attempts: true,
  maxAttempts: true,
  lastError: true,
  createdAt: true,
  runAt: true,
  completedAt: true,
} satisfies Prisma.JobSelect;

export async function listJobs(
  f: JobListFilters,
): Promise<{ jobs: JobListItem[]; total: number; page: number; pageSize: number }> {
  const where: Prisma.JobWhereInput = {
    ...(f.status ? { status: f.status } : {}),
    ...(f.kind ? { kind: f.kind } : {}),
    ...(f.from || f.to
      ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } }
      : {}),
    ...(f.q ? { recipient: { contains: f.q } } : {}),
  };
  // `paginate` borne la page demandee a la derniere page non vide.
  const result = await paginate(
    f,
    () => prisma.job.count({ where }),
    (range) =>
      prisma.job.findMany({
        where,
        select: LIST_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...range,
      }),
  );
  return { jobs: result.rows, total: result.total, page: result.page, pageSize: result.pageSize };
}

export async function listJobKinds(): Promise<string[]> {
  const rows = await prisma.job.findMany({
    distinct: ["kind"],
    select: { kind: true },
    orderBy: { kind: "asc" },
  });
  return rows.map((r) => r.kind);
}

export async function getJobCounts(
  now: Date = new Date(),
): Promise<{ pending: number; failed: number; sentLast24h: number }> {
  const [pending, failed, sentLast24h] = await Promise.all([
    prisma.job.count({ where: { status: { in: ["PENDING", "RUNNING"] } } }),
    prisma.job.count({ where: { status: "FAILED" } }),
    prisma.job.count({
      where: { status: "SUCCEEDED", completedAt: { gte: new Date(now.getTime() - DAY_MS) } },
    }),
  ]);
  return { pending, failed, sentLast24h };
}

export type JobDetail = JobListItem & {
  priority: number;
  subject: string | null;
  lockedAt: Date | null;
  lockedBy: string | null;
  updatedAt: Date;
  sensitive: boolean;
  purged: boolean;
  previewHtml: string | null;
  canRetry: boolean;
  canCancel: boolean;
};

// Le payload brut n'est jamais renvoye : seuls le sujet et, hors kind sensible, l'apercu HTML.
function toDetail(job: Job): JobDetail {
  const payload = parseEmailPayload(job.payload);
  const sensitive = isSensitiveEmailKind(job.kind);
  const purged = !payload || payload.html === "";
  return {
    id: job.id,
    type: job.type,
    kind: job.kind,
    recipient: job.recipient,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    lastError: job.lastError,
    createdAt: job.createdAt,
    runAt: job.runAt,
    completedAt: job.completedAt,
    priority: job.priority,
    subject: payload?.subject ?? null,
    lockedAt: job.lockedAt,
    lockedBy: job.lockedBy,
    updatedAt: job.updatedAt,
    sensitive,
    purged,
    previewHtml: sensitive || purged ? null : payload.html,
    canRetry: RETRYABLE.includes(job.status) && !purged,
    canCancel: job.status === "PENDING",
  };
}

export async function getJobDetail(id: string): Promise<JobDetail | null> {
  const job = await prisma.job.findUnique({ where: { id } });
  return job ? toDetail(job) : null;
}

export type JobActionResult =
  | { ok: true; job: JobDetail }
  | { ok: false; code: "NOT_FOUND" | "JOB_NOT_RETRYABLE" | "JOB_PAYLOAD_PURGED" | "JOB_NOT_CANCELLABLE" };

// Les mises a jour sont conditionnelles au statut attendu : une action concurrente du
// worker (ou d'un autre membre du staff) donne un compte de 0 et ne modifie rien.
export async function retryJob(id: string, now: Date = new Date()): Promise<JobActionResult> {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return { ok: false, code: "NOT_FOUND" };
  if (RETRYABLE.includes(job.status) && toDetail(job).purged) {
    return { ok: false, code: "JOB_PAYLOAD_PURGED" };
  }
  const { count } = await prisma.job.updateMany({
    where: { id, status: { in: RETRYABLE } },
    data: {
      status: "PENDING",
      attempts: 0,
      runAt: now,
      completedAt: null,
      lockedAt: null,
      lockedBy: null,
    },
  });
  if (count === 0) return { ok: false, code: "JOB_NOT_RETRYABLE" };
  return { ok: true, job: toDetail(await prisma.job.findUniqueOrThrow({ where: { id } })) };
}

export async function cancelJob(id: string, now: Date = new Date()): Promise<JobActionResult> {
  const job = await prisma.job.findUnique({ where: { id }, select: { id: true } });
  if (!job) return { ok: false, code: "NOT_FOUND" };
  const { count } = await prisma.job.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "CANCELLED", completedAt: now },
  });
  if (count === 0) return { ok: false, code: "JOB_NOT_CANCELLABLE" };
  return { ok: true, job: toDetail(await prisma.job.findUniqueOrThrow({ where: { id } })) };
}
