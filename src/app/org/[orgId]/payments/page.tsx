import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { hasOrgRole } from "@/lib/auth-helpers";
import { parseListPage } from "@/lib/list-query";
import { listPayments, parsePaymentFilters } from "@/lib/payments-query";
import { UrlPagination } from "@/components/ui/Pagination";
import { PaymentFilters } from "@/components/payments/PaymentFilters";
import { PaymentsTable } from "@/components/payments/PaymentsTable";

type SearchParams = Record<string, string | string[] | undefined>;

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function OrgPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { orgId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(`/login?callbackUrl=/org/${orgId}/payments`);
  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");
  if (!hasOrgRole(ctx, orgId, "MANAGER")) redirect(`/org/${orgId}`);

  const sp = await searchParams;
  const filters = parsePaymentFilters(sp, { allowOrg: false });
  const { page, pageSize, skip, take } = parseListPage(sp);
  const { items, total } = await listPayments(filters, { orgId }, { skip, take });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-navy">Paiements</h1>
        <p className="mt-0.5 text-sm text-slate-400">Abonnements et commandes d&apos;impression de votre organisation</p>
      </div>
      <PaymentFilters
        values={{ status: str(sp.status), purpose: str(sp.purpose), from: str(sp.from), to: str(sp.to), q: str(sp.q) }}
        showOrg={false}
        pageSize={pageSize}
        resetHref={`/org/${orgId}/payments`}
      />
      <PaymentsTable items={items} showOrg={false} detailHref={(p) => `/org/${orgId}/payments/${p.id}`} />
      {total > 0 && <UrlPagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} />}
    </div>
  );
}
