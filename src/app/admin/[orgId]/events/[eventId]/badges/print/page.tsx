import { BadgeBatchPanel } from "@/components/event/BadgeBatchPanel";

export default async function BatchPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
  searchParams: Promise<{ ids?: string }>;
}) {
  const { orgId, eventId } = await params;
  const { ids: idsParam } = await searchParams;
  const ids = (idsParam ?? "").split(",").filter(Boolean);
  const baseUrl = process.env.BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Impression batch ({ids.length} badges)</h1>
      <BadgeBatchPanel orgId={orgId} eventId={eventId} ids={ids} baseUrl={baseUrl} />
    </div>
  );
}
