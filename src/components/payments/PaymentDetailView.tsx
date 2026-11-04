import Link from "next/link";
import { Card, CardBody, CardHead } from "@/components/ui/Card";
import { KeyValue } from "@/components/ui/JournalBlocks";
import type { PaymentDetail } from "@/lib/payments-query";
import { MODE_LABELS, PURPOSE_LABELS, STATUS_LABELS, fcfa, fmtDate } from "./status";

// Fiche en lecture seule. `linkTo` porte les liens déjà calculés par la page (commande, organisation,
// plan) : le composant ne connaît pas l'espace (org ou staff) dans lequel il est rendu.
export function PaymentDetailView({
  payment,
  showOrg,
  linkTo,
}: {
  payment: PaymentDetail;
  showOrg: boolean;
  linkTo: { order?: string | null; org?: string | null; plan?: string | null };
}) {
  const subjectLink = payment.printRequest ? linkTo.order : payment.plan ? linkTo.plan : null;
  const subject = payment.printRequest ? `Commande ${payment.printRequest.reference}` : payment.label;
  const hasCredit = payment.purpose === "SUBSCRIPTION" && (payment.prorataCredit ?? 0) > 0 && payment.listPrice !== null;
  const hasPeriod = payment.purpose === "SUBSCRIPTION" && payment.coversFrom !== null && payment.coversTo !== null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHead title="Paiement" />
        <CardBody>
          <KeyValue
            items={[
              { label: "Montant", value: <span className="font-semibold">{fcfa(payment.amount)}</span> },
              { label: "Devise", value: payment.currency },
              { label: "Statut", value: STATUS_LABELS[payment.status] },
              { label: "Type", value: PURPOSE_LABELS[payment.purpose] },
              {
                label: payment.printRequest ? "Commande" : "Plan",
                value: subjectLink ? (
                  <Link href={subjectLink} className="text-navy hover:underline">
                    {subject}
                  </Link>
                ) : (
                  subject
                ),
              },
              ...(payment.mode ? [{ label: "Changement", value: MODE_LABELS[payment.mode] }] : []),
              { label: "Créé le", value: fmtDate(payment.createdAt) },
              { label: "Approuvé le", value: payment.approvedAt ? fmtDate(payment.approvedAt) : "—" },
              { label: "Référence FedaPay", value: <span className="font-mono text-xs">{payment.fedapayReference ?? "—"}</span> },
              {
                label: "Identifiant FedaPay",
                value: <span className="font-mono text-xs">{payment.fedapayTransactionId ?? "—"}</span>,
              },
              {
                label: "Payeur",
                value: payment.payerName ? `${payment.payerName}${payment.payerEmail ? ` (${payment.payerEmail})` : ""}` : "—",
              },
              ...(showOrg
                ? [
                    {
                      label: "Organisation",
                      value: linkTo.org ? (
                        <Link href={linkTo.org} className="text-navy hover:underline">
                          {payment.orgName}
                        </Link>
                      ) : (
                        payment.orgName
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </CardBody>
      </Card>

      {(hasCredit || hasPeriod) && (
        <Card>
          <CardHead title="Détail de l'abonnement" />
          <CardBody>
            <KeyValue
              items={[
                ...(hasCredit
                  ? [
                      { label: "Prix plein", value: fcfa(payment.listPrice as number) },
                      { label: "Crédit déduit", value: `− ${fcfa(payment.prorataCredit as number)}` },
                      { label: "Montant payé", value: <span className="font-semibold">{fcfa(payment.amount)}</span> },
                    ]
                  : []),
                ...(hasPeriod
                  ? [
                      {
                        label: "Période couverte",
                        value: `Période couverte du ${fmtDate(payment.coversFrom as Date)} au ${fmtDate(payment.coversTo as Date)}`,
                      },
                    ]
                  : []),
              ]}
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
