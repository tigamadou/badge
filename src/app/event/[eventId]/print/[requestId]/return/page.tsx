import Link from "next/link";
import { requirePrintAccess } from "@/components/event/print/guard";
import { resolvePrintPaymentReturn } from "@/lib/payment-return";
import { Card, CardBody } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Feedback";

export const dynamic = "force-dynamic";

export default async function PrintPaymentReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string; requestId: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { eventId, requestId } = await params;
  const { id } = await searchParams;
  // Session, évènement et droit « print.request » : redirection sinon.
  const query = id ? `?id=${encodeURIComponent(id)}` : "";
  const { orgId } = await requirePrintAccess(eventId, `/print/${requestId}/return${query}`);

  const { outcome, reference } = await resolvePrintPaymentReturn({ requestId, eventId, orgId, rawId: id });

  return (
    <div className="mx-auto max-w-xl p-6">
      <Card>
        <CardBody>
          <div className="space-y-4">
            {outcome === "PAID" && (
              <Alert tone="success">
                Paiement confirmé. La demande {reference} est payée ; l&apos;équipe Badge lance la production.
              </Alert>
            )}
            {outcome === "UNMATCHED" && (
              <Alert tone="info">
                Paiement reçu. L&apos;équipe Badge vérifie votre demande et revient vers vous.
              </Alert>
            )}
            {outcome === "MISMATCH" && (
              <Alert tone="info">
                Paiement reçu pour un montant inattendu. L&apos;équipe Badge vérifie et vous recontacte.
              </Alert>
            )}
            {outcome === "PENDING" && (
              <Alert tone="info">
                Paiement en cours de confirmation. Cette page se met à jour dès que FedaPay confirme.{" "}
                <Link
                  href={`/event/${eventId}/print/${requestId}/return?id=${encodeURIComponent(id ?? "")}`}
                  className="font-medium underline"
                >
                  Actualiser
                </Link>
              </Alert>
            )}
            {outcome === "FAILED" && (
              <Alert tone="err">
                Le paiement n&apos;a pas abouti. Votre devis reste accepté : vous pouvez réessayer.
              </Alert>
            )}
            {outcome === "NOT_FOUND" && <Alert tone="err">Paiement introuvable.</Alert>}
            <Link href={`/event/${eventId}/print/${requestId}`} className="font-medium underline">
              Retour à la demande
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
