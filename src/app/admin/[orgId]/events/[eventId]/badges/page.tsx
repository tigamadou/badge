import { BadgeListTable } from "@/components/event/BadgeListTable";

export default async function BadgesPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Badges</h1>
      <BadgeListTable orgId={orgId} eventId={eventId} />
    </div>
  );
}
