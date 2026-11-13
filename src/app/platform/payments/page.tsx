import { requirePlatformPage } from "../page-guard";
import { parseListPage } from "@/lib/list-query";
import { listPayments, parsePaymentFilters } from "@/lib/payments-query";
import { UrlPagination } from "@/components/ui/Pagination";
import { PaymentFilters } from "@/components/payments/PaymentFilters";
import { PaymentsTable } from "@/components/payments/PaymentsTable";

type SearchParams = Record<string, string | string[] | undefined>;

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Lecture seule : `payments.read`.
export default async function PlatformPaymentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePlatformPage("payments.read", "/platform/payments");
  const sp = await searchParams;
  const filters = parsePaymentFilters(sp, { allowOrg: true });
  const { page, pageSize, skip, take } = parseListPage(sp);
  const { items, total } = await listPayments(filters, {}, { skip, take });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-navy">Paiements</h1>
        <p className="mt-0.5 text-sm text-slate-400">Tous les paiements d&apos;abonnement et d&apos;impression</p>
      </div>
      <PaymentFilters
        values={{
          status: str(sp.status),
          purpose: str(sp.purpose),
          from: str(sp.from),
          to: str(sp.to),
          q: str(sp.q),
          orgQuery: str(sp.orgQuery),
        }}
        showOrg
        pageSize={pageSize}
        resetHref="/platform/payments"
      />
      <PaymentsTable
        items={items}
        showOrg
        detailHref={(p) => `/platform/payments/${p.id}`}
        orgHref={(p) => `/platform/organizations/${p.orgId}`}
      />
      {total > 0 && <UrlPagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} />}
    </div>
  );
}
