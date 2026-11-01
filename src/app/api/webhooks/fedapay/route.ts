import { NextRequest, NextResponse } from "next/server";
import { getFedapayConfig, verifyWebhookSignature } from "@/lib/fedapay";
import { confirmPayment } from "@/lib/payments";

// Webhook FedaPay : hors session (non couvert par le matcher du middleware).
// La signature se calcule sur le corps brut, avant tout JSON.parse.
export async function POST(req: NextRequest) {
  const fedapay = getFedapayConfig();
  if (!fedapay.configured) {
    return NextResponse.json({ error: "Paiements désactivés" }, { status: 503 });
  }

  const raw = await req.text();
  try {
    verifyWebhookSignature(raw, req.headers.get("x-fedapay-signature"), fedapay.webhookSecret);
  } catch {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  // Toujours 200 après signature valide : FedaPay désactive un webhook qui échoue.
  // La tâche horaire reprend les paiements restés PENDING.
  try {
    const event = JSON.parse(raw) as { name?: unknown; entity?: { id?: unknown } };
    const id = event.entity?.id;
    if (typeof event.name === "string" && event.name.startsWith("transaction.") && typeof id === "number") {
      await confirmPayment(id);
    }
  } catch (error) {
    console.error("[webhook fedapay]", error);
  }
  return NextResponse.json({ received: true });
}
