import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/ui/Icon";
import { PrintRequestWizard } from "@/components/event/print/PrintRequestWizard";
import { getAvailableOrgPrintCredit } from "@/lib/print-requests/org-credit";
import { requirePrintAccess } from "@/components/event/print/guard";

export const dynamic = "force-dynamic";

const EDITABLE = ["DRAFT", "SUBMITTED", "QUOTED"];

export default async function EditPrintRequestPage({
  params,
}: {
  params: Promise<{ eventId: string; requestId: string }>;
}) {
  const { eventId, requestId } = await params;
  const { event, orgId, ctx } = await requirePrintAccess(eventId, `/print/${requestId}/edit`);
  const request = await prisma.printRequest.findFirst({
    where: { id: requestId, eventId },
    select: { id: true, reference: true, status: true },
  });
  if (!request) notFound();
  // Hors statuts modifiables, évènement archivé ou staff : retour au détail.
  if (!EDITABLE.includes(request.status) || event.archived || ctx.isStaff) {
    redirect(`/event/${eventId}/print/${requestId}`);
  }
  const availableCredit = await getAvailableOrgPrintCredit(orgId, requestId);
  return (
    <div className="space-y-4">
      <Link
        href={`/event/${eventId}/print/${requestId}`}
        className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-700"
      >
        <Icon name="arrow-left" size={14} /> {request.reference}
      </Link>
      <h1 className="text-xl font-semibold text-navy">{`Modifier la commande ${request.reference}`}</h1>
      <PrintRequestWizard orgId={orgId} eventId={eventId} requestId={requestId} availableCredit={availableCredit} />
    </div>
  );
}
