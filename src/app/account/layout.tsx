import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccountNav } from "@/components/public/AccountNav";
import { LogoutButton } from "@/components/auth/LogoutButton";

function initials(name: string | null): string {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/account">
              <Image src="/logo.png" alt="Badge" width={100} height={26} className="h-[26px] w-auto object-contain" />
            </Link>
            <AccountNav />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 sm:inline">{user.name}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-brand-navy">
              {initials(user.name)}
            </span>
            <LogoutButton
              label="Se déconnecter"
              className="flex items-center gap-1.5 text-slate-500 hover:text-green-600"
            />
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
