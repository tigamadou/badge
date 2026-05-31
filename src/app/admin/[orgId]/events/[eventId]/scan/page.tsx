import { QRScanner } from "@/components/event/QRScanner";

export default async function ScanPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Scanner les badges</h1>
      <QRScanner orgId={orgId} eventId={eventId} />
    </div>
  );
}
