import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NotificationsView } from "@/components/notifications/NotificationsView";

export default async function OrgNotificationsPage({ params, searchParams }: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ unread?: string; cursor?: string }>;
}) {
  const session = await getServerSession(authOptions);
  // Le layout de l'espace a déjà garanti la session et l'accès.
  const userId = session!.user!.id as string;
  const { orgId } = await params;
  return <NotificationsView userId={userId} scope={{ kind: "org", orgId }} searchParams={await searchParams} />;
}
