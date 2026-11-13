import Link from "next/link";
import type { PrintRequestStatus } from "@prisma/client";
import { EmptyState } from "@/components/ui/Feedback";
import { PrintRequestStatusBadge } from "@/components/print/PrintRequestStatusBadge";

export type OnsiteOrderRow = {
  id: string;
  reference: string;
  status: PrintRequestStatus;
  onsiteLocation: string | null;
};

// Commandes d'impression sur place ouvertes au poste. Aucun prix ni ligne de devis : la liste
// est lue par l'agent d'organisation, qui n'a pas `print.request`.
export function OnsiteOrderList({ eventId, rows }: { eventId: string; rows: OnsiteOrderRow[] }) {
  if (rows.length === 0) {
    return <EmptyState icon="printer" title="Aucune commande ouverte au poste sur place." />;
  }
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/event/${eventId}/print/${r.id}/onsite`}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-mist"
          >
            <span>
              <span className="font-medium text-navy">{r.reference}</span>
              {r.onsiteLocation ? <span className="ml-2 text-slate-400">{r.onsiteLocation}</span> : null}
            </span>
            <span className="flex items-center gap-3">
              <PrintRequestStatusBadge status={r.status} />
              <span className="text-[13px] font-medium text-navy">Ouvrir le poste</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
