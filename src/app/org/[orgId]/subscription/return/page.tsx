import Link from "next/link";
import { requireOrgPagePermission } from "@/app/org/[orgId]/_lib/page-access";
import { resolvePaymentReturn } from "@/lib/payment-return";
import { Card, CardBody } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Feedback";

export default async function PaymentReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { orgId } = await params;
  const { id } = await searchParams;
  await requireOrgPagePermission(orgId, "billing.subscription.read", `/org/${orgId}/subscription`);

  const { outcome, planName, activationDate } = await resolvePaymentReturn(orgId, id);

  return (
    <div className="mx-auto max-w-xl p-6">
      <Card>
        <CardBody>
          <div className="space-y-4">
            {outcome === "APPROVED" && (
              <Alert tone="success">Paiement confirmé. Votre abonnement {planName} est actif.</Alert>
            )}
            {outcome === "SCHEDULED" && (
              <Alert tone="success">
                Paiement confirmé. Votre abonnement {planName} sera activé
                {activationDate ? ` le ${activationDate.toLocaleDateString("fr-FR")}` : " à la fin de la période en cours"}.
              </Alert>
            )}
            {outcome === "PENDING" && (
              <Alert tone="info">
                Paiement en cours de confirmation. Cette page se met à jour dès que FedaPay confirme.{" "}
                <Link href={`/org/${orgId}/subscription/return?id=${id}`} className="font-medium underline">
                  Actualiser
                </Link>
              </Alert>
            )}
            {outcome === "FAILED" && (
              <Alert tone="err">Le paiement n&apos;a pas abouti. Votre abonnement n&apos;a pas changé.</Alert>
            )}
            {outcome === "NOT_FOUND" && <Alert tone="err">Paiement introuvable.</Alert>}
            <Link href={`/org/${orgId}/subscription`} className="font-medium underline">
              Retour à l&apos;abonnement
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
