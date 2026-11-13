import { requirePlatformPage } from "@/app/platform/page-guard";
import { NotificationsView } from "@/components/notifications/NotificationsView";

export default async function PlatformNotificationsPage({ searchParams }: { searchParams: Promise<{ unread?: string; cursor?: string }> }) {
  const { userId } = await requirePlatformPage("platform.access", "/platform/notifications");
  return <NotificationsView userId={userId} scope={{ kind: "platform" }} searchParams={await searchParams} />;
}
