import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { prisma } from "@/lib/prisma";
import { RequestDetail } from "@/components/staff/print/RequestDetail";
import { OnsiteError } from "@/lib/print-requests/onsite";
import { loadOnsiteOverview } from "@/lib/print-requests/onsite-station";
import {
  getAvailableOrgPrintCredit,
  getOrgPrintCreditBalance,
  listOrgPrintCreditMovements,
} from "@/lib/print-requests/org-credit";
import { PAYMENT_HISTORY_SELECT, toPaymentHistoryItem } from "@/lib/payment-history";

export default async function PrintRequestDetailPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  // Le layout /platform garantit déjà un membre du staff ; cette garde sert le typage.
  if (!ctx || !ctx.isStaff || !ctx.staffRole) notFound();

  // Produits proposés à l'ajout d'une ligne produit (STAFF_ADMIN seulement).
  const products =
    ctx.staffRole === "STAFF_ADMIN" || ctx.staffRole === "SUPER_ADMIN"
      ? await prisma.printProduct.findMany({
          where: { archived: false },
          orderBy: [{ position: "asc" }, { name: "asc" }],
          select: { id: true, name: true, basePrice: true },
        })
      : [];

  // Paiements de cette commande (FedaPay), du plus récent au plus ancien.
  const payments = (
    await prisma.payment.findMany({
      where: { printRequestId: requestId },
      orderBy: { createdAt: "desc" },
      select: PAYMENT_HISTORY_SELECT,
    })
  ).map(toPaymentHistoryItem);

  // Commande, crédit de l'organisation et liens vers la commande principale / les compléments.
  const request = await prisma.printRequest.findUnique({
    where: { id: requestId },
    select: {
      orgId: true,
      status: true,
      parentRequestId: true,
      parentRequest: { select: { id: true, reference: true } },
      childRequests: { select: { id: true, reference: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!request) notFound();
  const [lines, balance, available, movements] = await Promise.all([
    prisma.printQuoteLine.findMany({
      where: { requestId, removedAt: null },
      select: { lineTotal: true, usesOrgCredit: true },
    }),
    getOrgPrintCreditBalance(request.orgId),
    getAvailableOrgPrintCredit(request.orgId, requestId),
    listOrgPrintCreditMovements(request.orgId),
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
      role={ctx.staffRole}
      products={products}
      payments={payments}
      onsiteCounter={onsiteCounter}
      credit={{ balance, available, applied, grossTotal, movements }}
      parentRequest={request.parentRequest}
      supplements={request.childRequests}
    />
  );
}
