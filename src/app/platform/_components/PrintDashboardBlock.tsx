import Link from "next/link";
import { Card, CardBody, CardHead } from "@/components/ui/Card";
import { StatCard, StatGrid } from "@/components/ui/StatCard";

/** Bloc du tableau de bord de l'Imprimeur : commandes à traiter et planches à générer. */
export function PrintDashboardBlock({
  ordersToProcess,
  sheetsToGenerate,
}: {
  // null : l'utilisateur n'a pas la permission correspondante, le chiffre n'est pas affiché.
  ordersToProcess: number | null;
  sheetsToGenerate: number | null;
}) {
  return (
    <Card>
      <CardHead title="Impression" subtitle="Ce qui attend l'équipe de production" />
      <CardBody className="space-y-4">
        <StatGrid cols={3}>
          {ordersToProcess !== null && (
            <StatCard label="Commandes à traiter" value={ordersToProcess} icon="inbox" />
          )}
          {sheetsToGenerate !== null && (
            <StatCard label="Planches à générer" value={sheetsToGenerate} icon="printer" />
          )}
        </StatGrid>
        <div className="flex flex-wrap gap-4 text-[13px] font-medium text-navy">
          {ordersToProcess !== null && (
            <Link href="/platform/print/orders" className="hover:underline">
              Ouvrir les commandes
            </Link>
          )}
          {sheetsToGenerate !== null && (
            <Link href="/platform/print/sheets" className="hover:underline">
              Ouvrir les planches
            </Link>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
