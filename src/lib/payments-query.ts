import type {
  PaymentPurpose,
  PaymentStatus,
  Prisma,
  SubscriptionChangeMode,
  SubscriptionPeriod,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Lecture des paiements pour le module Paiements (staff et organisations). Les filtres viennent de
// l'URL : toute valeur invalide est ignoree, jamais d'erreur. Le scope d'organisation est impose
// par l'appelant, jamais par les filtres.

export type PaymentFilters = {
  status?: PaymentStatus;
  purpose?: PaymentPurpose;
  orgId?: string;
  // Recherche libre sur le nom ou l'identifiant court (slug) de l'organisation (staff).
  orgQuery?: string;
  from?: Date;
  to?: Date;
  q?: string;
};

type Params = Record<string, string | string[] | undefined>;

const STATUSES: PaymentStatus[] = ["PENDING", "APPROVED", "DECLINED", "CANCELED", "EXPIRED"];
const PURPOSES: PaymentPurpose[] = ["SUBSCRIPTION", "PRINT_REQUEST"];
const QUERY_MAX = 64;

function first(params: Params, key: string): string | undefined {
  const v = params[key];
  return (Array.isArray(v) ? v[0] : v) ?? undefined;
}

// « AAAA-MM-JJ » strictement valide (2026-02-31 refuse), en UTC.
function parseDay(raw: string | undefined, endOfDay: boolean): Date | undefined {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const date = new Date(`${raw}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return undefined;
  return date;
}

export function parsePaymentFilters(params: Params, opts: { allowOrg: boolean }): PaymentFilters {
  const filters: PaymentFilters = {};

  const status = first(params, "status") as PaymentStatus | undefined;
  if (status && STATUSES.includes(status)) filters.status = status;
  const purpose = first(params, "purpose") as PaymentPurpose | undefined;
  if (purpose && PURPOSES.includes(purpose)) filters.purpose = purpose;

  const from = parseDay(first(params, "from"), false);
  const to = parseDay(first(params, "to"), true);
  if (from && to && from > to) {
    // Periode incoherente : ni l'une ni l'autre borne.
  } else {
    if (from) filters.from = from;
    if (to) filters.to = to;
  }

  const q = first(params, "q")?.trim().slice(0, QUERY_MAX).trim();
  if (q) filters.q = q;

  if (opts.allowOrg) {
    const orgId = first(params, "orgId")?.trim().slice(0, QUERY_MAX);
    if (orgId) filters.orgId = orgId;
    const orgQuery = first(params, "orgQuery")?.trim().slice(0, QUERY_MAX).trim();
    if (orgQuery) filters.orgQuery = orgQuery;
  }
  return filters;
}

export function paymentWhere(filters: PaymentFilters, scope: { orgId?: string }): Prisma.PaymentWhereInput {
  const orgId = scope.orgId ?? filters.orgId;
  return {
    ...(orgId ? { orgId } : {}),
    ...(!scope.orgId && filters.orgQuery
      ? { org: { OR: [{ name: { contains: filters.orgQuery } }, { slug: { contains: filters.orgQuery } }] } }
      : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.purpose ? { purpose: filters.purpose } : {}),
    ...(filters.from || filters.to
      ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
      : {}),
    ...(filters.q ? { fedapayReference: { contains: filters.q } } : {}),
  };
}

const PAYMENT_LIST_SELECT = {
  id: true,
  createdAt: true,
  approvedAt: true,
  amount: true,
  currency: true,
  status: true,
  purpose: true,
  mode: true,
  fedapayReference: true,
  orgId: true,
  planId: true,
  org: { select: { name: true } },
  plan: { select: { name: true } },
  printRequest: { select: { id: true, reference: true, eventId: true } },
} satisfies Prisma.PaymentSelect;

const PAYMENT_DETAIL_SELECT = {
  ...PAYMENT_LIST_SELECT,
  listPrice: true,
  prorataCredit: true,
  coversFrom: true,
  coversTo: true,
  fedapayTransactionId: true,
  plan: { select: { id: true, name: true, period: true } },
  user: { select: { name: true, email: true } },
} satisfies Prisma.PaymentSelect;

export type PaymentListItem = {
  id: string;
  createdAt: Date;
  approvedAt: Date | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  purpose: PaymentPurpose;
  mode: SubscriptionChangeMode | null;
  fedapayReference: string | null;
  orgId: string;
  orgName: string;
  label: string;
  planId: string | null;
  printRequest: { id: string; reference: string; eventId: string } | null;
};

export type PaymentDetail = PaymentListItem & {
  listPrice: number | null;
  prorataCredit: number | null;
  coversFrom: Date | null;
  coversTo: Date | null;
  fedapayTransactionId: number | null;
  payerName: string | null;
  payerEmail: string | null;
  plan: { id: string; name: string; period: SubscriptionPeriod } | null;
};

function toListItem(row: Prisma.PaymentGetPayload<{ select: typeof PAYMENT_LIST_SELECT }>): PaymentListItem {
  const { org, plan, ...rest } = row;
  return {
    ...rest,
    orgName: org.name,
    label: plan?.name ?? (row.printRequest ? `Impression ${row.printRequest.reference}` : "—"),
  };
}

export async function listPayments(
  filters: PaymentFilters,
  scope: { orgId?: string },
  page: { skip: number; take: number },
): Promise<{ items: PaymentListItem[]; total: number }> {
  const where = paymentWhere(filters, scope);
  const [rows, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: page.skip,
      take: page.take,
      select: PAYMENT_LIST_SELECT,
    }),
    prisma.payment.count({ where }),
  ]);
  return { items: rows.map(toListItem), total };
}

// Un paiement hors scope est indiscernable d'un paiement inconnu (null).
export async function loadPayment(id: string, scope: { orgId?: string }): Promise<PaymentDetail | null> {
  const row = await prisma.payment.findFirst({
    where: { id, ...(scope.orgId ? { orgId: scope.orgId } : {}) },
    select: PAYMENT_DETAIL_SELECT,
  });
  if (!row) return null;
  const { user, ...rest } = row;
  return {
    ...toListItem(row),
    listPrice: rest.listPrice,
    prorataCredit: rest.prorataCredit,
    coversFrom: rest.coversFrom,
    coversTo: rest.coversTo,
    fedapayTransactionId: rest.fedapayTransactionId,
    payerName: user?.name ?? null,
    payerEmail: user?.email ?? null,
    plan: rest.plan,
  };
}
