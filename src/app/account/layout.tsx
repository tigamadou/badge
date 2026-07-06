import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/account" className="font-semibold text-slate-900">
              Mon compte
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/account" className="text-slate-700 hover:text-green-600">
                Mes inscriptions
              </Link>
              <Link href="/account/profile" className="text-slate-700 hover:text-green-600">
                Mon profil
              </Link>
            </nav>
          </div>
          <div className="text-sm text-slate-600">
            <span className="hidden sm:inline">{user.name}</span>
            <span className="mx-2 text-slate-300">·</span>
            <Link
              href="/api/auth/signout"
              className="text-slate-700 hover:text-green-600"
              prefetch={false}
            >
              Se déconnecter
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
