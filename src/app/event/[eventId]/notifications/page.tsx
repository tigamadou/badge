import { requireEventPagePermission } from "../_lib/page-access";
import { NotificationsView } from "@/components/notifications/NotificationsView";

export default async function EventNotificationsPage({ params, searchParams }: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ unread?: string; cursor?: string }>;
}) {
  const { eventId } = await params;
  const { ctx } = await requireEventPagePermission(eventId, null, `/event/${eventId}/notifications`);
  const userId = ctx.user.id;
  return <NotificationsView userId={userId} scope={{ kind: "event", eventId }} searchParams={await searchParams} />;
}
