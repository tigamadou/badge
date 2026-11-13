import { requirePlatformPage } from "@/app/platform/page-guard";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPayment } from "@/lib/payments-query";
import { Icon } from "@/components/ui/Icon";
import { PaymentDetailView } from "@/components/payments/PaymentDetailView";

export default async function PlatformPaymentPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  await requirePlatformPage("payments.read", `/platform/payments/${paymentId}`);
  const payment = await loadPayment(paymentId, {});
  if (!payment) notFound();

  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/platform/payments" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <Icon name="arrow-left" size={16} /> Paiements
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-navy">Paiement</h1>
        {payment.status === "APPROVED" && (
          <a
            href={`/platform/payments/${payment.id}/receipt`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-mist"
          >
            <Icon name="printer" size={16} /> Imprimer le reçu
          </a>
        )}
      </div>
      <PaymentDetailView
        payment={payment}
        showOrg
        linkTo={{
          org: `/platform/organizations/${payment.orgId}`,
          order: payment.printRequest ? `/platform/print/orders/${payment.printRequest.id}` : null,
          plan: payment.plan ? "/platform/plans" : null,
        }}
      />
    </div>
  );
}
