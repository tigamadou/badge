import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AuthError, requireStaff } from "@/lib/auth-guards";
import { loadPayment } from "@/lib/payments-query";
import { renderReceiptHtml } from "@/components/payments/receipt";

// Reçu imprimable d'un paiement approuvé, pour tout rôle staff (lecture seule).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ paymentId: string }> },
): Promise<Response> {
  const { paymentId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await requireStaff(session.user.id, "STAFF_OBSERVER");
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.httpStatus });
    throw err;
  }

  const payment = await loadPayment(paymentId, {});
  if (!payment || payment.status !== "APPROVED") {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return new Response(renderReceiptHtml(payment, new Date()), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
  });
}
