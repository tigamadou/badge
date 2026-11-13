import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { hasPermission } from "@/lib/permissions";
import { loadPayment } from "@/lib/payments-query";
import { renderReceiptHtml } from "@/components/payments/receipt";

// Reçu imprimable d'un paiement approuvé de l'organisation (permission `billing.payments.read`, comme la page Paiements).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; paymentId: string }> },
): Promise<Response> {
  const { orgId, paymentId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ctx = await loadUserContext(session.user.id);
  if (!ctx || !hasPermission(ctx, "billing.payments.read", { kind: "org", orgId })) {
    return NextResponse.json({ error: "ORG_FORBIDDEN" }, { status: 403 });
  }

  const payment = await loadPayment(paymentId, { orgId });
  if (!payment || payment.status !== "APPROVED") {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return new Response(renderReceiptHtml(payment, new Date()), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
  });
}
