import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getApprovedPhotoUrl } from "@/lib/approved-photo";
import { AccountNav } from "@/components/public/AccountNav";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { PageDocButton } from "@/components/page-docs/PageDocButton";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id as string },
    select: { name: true, email: true, participantProfileCompletedAt: true },
  });
  if (!user) {
    redirect("/login?callbackUrl=/account");
  }

  const photoUrl = await getApprovedPhotoUrl(session.user.id as string);

  return (
    <div className="min-h-screen bg-mist">
      <header className="border-b-2 border-gold bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-6">
            <Link href="/account" className="flex-none">
              <Image src="/logo.png" alt="Badge" width={100} height={26} className="h-[26px] w-auto flex-none object-contain" />
            </Link>
            <AccountNav />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 sm:inline">{user.name}</span>
            <PageDocButton />
            <NotificationBell scope={{ kind: "participant" }} />
            <UserAvatar name={user.name} photoUrl={photoUrl} />
            <LogoutButton
              label="Se déconnecter"
              labelClassName="hidden sm:inline"
              className="flex items-center gap-1.5 text-slate-500 hover:text-navy"
            />
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
