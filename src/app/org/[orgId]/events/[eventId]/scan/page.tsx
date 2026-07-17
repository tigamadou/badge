import { QRScanner } from "@/components/event/QRScanner";

export default async function ScanPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Scanner</h1>
        <p className="mt-0.5 text-sm text-slate-400">Contrôle d&apos;accès par lecture des QR codes de badge</p>
      </div>
      <QRScanner orgId={orgId} eventId={eventId} />
    </div>
  );
}
