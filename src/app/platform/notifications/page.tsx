import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NotificationsView } from "@/components/notifications/NotificationsView";

export default async function PlatformNotificationsPage({ searchParams }: { searchParams: Promise<{ unread?: string; cursor?: string }> }) {
  const session = await getServerSession(authOptions);
  // Le layout de l'espace a déjà garanti la session et l'accès.
  const userId = session!.user!.id as string;
  return <NotificationsView userId={userId} scope={{ kind: "platform" }} searchParams={await searchParams} />;
}
