import { notFound } from "next/navigation";
import { requirePlatformPage } from "@/app/platform/page-guard";
import { loadPermissions } from "@/lib/auth-guards";
import { eventTargetOf } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { RequestDetail } from "@/components/staff/print/RequestDetail";
import { OnsiteError } from "@/lib/print-requests/onsite";
import { getOrderSheet } from "@/lib/print-sheets/order-sheet";
import { loadOnsiteOverview } from "@/lib/print-requests/onsite-station";
import {
  getAvailableOrgPrintCredit,
  getOrgPrintCreditBalance,
  listOrgPrintCreditMovements,
} from "@/lib/print-requests/org-credit";
import { PAYMENT_HISTORY_SELECT, toPaymentHistoryItem } from "@/lib/payment-history";

export default async function PrintRequestDetailPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const { userId, permissions } = await requirePlatformPage("print.requests.read", `/platform/print/orders/${requestId}`);

  // Produits proposés à l'ajout d'une ligne produit (avec `print.requests.quote.edit` seulement).
  const products = permissions.has("print.requests.quote.edit")
    ? await prisma.printProduct.findMany({
          where: { archived: false },
          orderBy: [{ position: "asc" }, { name: "asc" }],
          select: { id: true, name: true, basePrice: true },
        })
    : [];

  // Paiements de cette commande (FedaPay), du plus récent au plus ancien.
  // Réservés à `payments.read` : une commande lisible ne donne pas accès aux paiements.
  const payments = permissions.has("payments.read")
    ? (
        await prisma.payment.findMany({
          where: { printRequestId: requestId },
          orderBy: { createdAt: "desc" },
          select: PAYMENT_HISTORY_SELECT,
        })
      ).map(toPaymentHistoryItem)
    : [];

  // Commande, crédit de l'organisation et liens vers la commande principale / les compléments.
  const request = await prisma.printRequest.findUnique({
    where: { id: requestId },
    select: {
      orgId: true,
      eventId: true,
      status: true,
      parentRequestId: true,
      parentRequest: { select: { id: true, reference: true } },
      childRequests: { select: { id: true, reference: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!request) notFound();
  const canOperateOnsite = (await loadPermissions(userId, eventTargetOf(request))).has("print.onsite.operate");
  // Le crédit de l'organisation n'est chargé que pour qui peut l'appliquer.
  const canSeeCredit = permissions.has("print.requests.credit.apply");
  const [lines, balance, available, movements, sheet] = await Promise.all([
    prisma.printQuoteLine.findMany({
      where: { requestId, removedAt: null },
      select: { lineTotal: true, usesOrgCredit: true },
    }),
    canSeeCredit ? getOrgPrintCreditBalance(request.orgId) : 0,
    canSeeCredit ? getAvailableOrgPrintCredit(request.orgId, requestId) : 0,
    canSeeCredit ? listOrgPrintCreditMovements(request.orgId) : [],
    getOrderSheet(requestId),
  ]);
  const applied = -lines.filter((l) => l.usesOrgCredit).reduce((sum, l) => sum + l.lineTotal, 0);
  const grossTotal = lines.filter((l) => !l.usesOrgCredit).reduce((sum, l) => sum + l.lineTotal, 0);

  // Compteur de l'impression sur place ; absent pour une commande en amont, complémentaire ou inexistante.
  const onsiteCounter =
    request.parentRequestId !== null
      ? null
      : await loadOnsiteOverview(requestId).then(
          (r) => r.counter,
          (err) => {
            if (err instanceof OnsiteError) return null;
            throw err;
          },
        );

  return (
    <RequestDetail
      requestId={requestId}
      permissions={[...permissions]}
      canOperateOnsite={canOperateOnsite}
      products={products}
      payments={payments}
      onsiteCounter={onsiteCounter}
      sheet={sheet}
      credit={canSeeCredit ? { balance, available, applied, grossTotal, movements } : null}
      parentRequest={request.parentRequest}
      supplements={request.childRequests}
    />
  );
}
