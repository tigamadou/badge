import { QRScanner } from "@/components/event/QRScanner";
import { requireEventPagePermission } from "../_lib/page-access";

export default async function ScanPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { orgId } = await requireEventPagePermission(eventId, "scan.check-in", `/event/${eventId}/scan`);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-navy">Scanner</h1>
        <p className="mt-0.5 text-sm text-slate-400">Contrôle d&apos;accès par lecture des QR codes de badge</p>
      </div>
      <QRScanner orgId={orgId} eventId={eventId} />
    </div>
  );
}
