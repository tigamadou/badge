import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { hasOrgRole } from "@/lib/auth-helpers";
import { loadPayment } from "@/lib/payments-query";
import { Icon } from "@/components/ui/Icon";
import { PaymentDetailView } from "@/components/payments/PaymentDetailView";

export default async function OrgPaymentPage({
  params,
}: {
  params: Promise<{ orgId: string; paymentId: string }>;
}) {
  const { orgId, paymentId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(`/login?callbackUrl=/org/${orgId}/payments/${paymentId}`);
  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");
  if (!hasOrgRole(ctx, orgId, "MANAGER")) redirect(`/org/${orgId}`);

  // Scope d'organisation : le paiement d'une autre organisation donne 404, comme un id inconnu.
  const payment = await loadPayment(paymentId, { orgId });
  if (!payment) notFound();

  return (
    <div className="max-w-2xl space-y-4">
      <Link
        href={`/org/${orgId}/payments`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <Icon name="arrow-left" size={16} /> Paiements
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Paiement</h1>
        {payment.status === "APPROVED" && (
          <a
            href={`/org/${orgId}/payments/${payment.id}/receipt`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-mist"
          >
            <Icon name="printer" size={16} /> Imprimer le reçu
          </a>
        )}
      </div>
      <PaymentDetailView payment={payment} showOrg={false} linkTo={{}} />
    </div>
  );
}
