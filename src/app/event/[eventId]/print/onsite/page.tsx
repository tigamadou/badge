import { prisma } from "@/lib/prisma";
import { OnsiteOrderList } from "@/components/event/print/OnsiteOrderList";
import { requireEventPagePermission } from "../../_lib/page-access";

export const dynamic = "force-dynamic";

// Liste des commandes sur place ouvertes au poste de l'évènement. Sélection explicite : ni total ni lignes de devis.
export default async function OnsiteOrdersPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event } = await requireEventPagePermission(eventId, "print.onsite.operate", `/event/${eventId}/print/onsite`);
  const rows = event.archived
    ? []
    : await prisma.printRequest.findMany({
        where: { eventId, type: "ONSITE", parentRequestId: null, status: { in: ["PAID", "IN_PRODUCTION", "READY"] } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true, reference: true, status: true, onsiteLocation: true },
      });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-navy">Poste sur place</h1>
        <p className="mt-0.5 text-sm text-slate-400">Imprimez les badges des participants déjà approuvés</p>
      </div>
      <OnsiteOrderList eventId={eventId} rows={rows} />
    </div>
  );
}
