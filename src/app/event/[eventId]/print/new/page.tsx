import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { NewPrintRequestForm } from "@/components/event/print/NewPrintRequestForm";
import { requirePrintAccess } from "@/components/event/print/guard";

export const dynamic = "force-dynamic";

export default async function NewPrintRequestPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event, orgId, ctx } = await requirePrintAccess(eventId, "/print/new");
  // Pas de nouvelle commande sur un évènement archivé, ni pour le staff (lecture seule).
  if (event.archived || ctx.isStaff) redirect(`/event/${eventId}/print`);
  return (
    <div className="space-y-4">
      <Link
        href={`/event/${eventId}/print`}
        className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-700"
      >
        <Icon name="arrow-left" size={14} /> Impression
      </Link>
      <h1 className="text-xl font-semibold text-slate-900">Nouvelle commande d&apos;impression</h1>
      <NewPrintRequestForm orgId={orgId} eventId={eventId} />
    </div>
  );
}
