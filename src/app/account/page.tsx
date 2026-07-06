import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Alert, EmptyState } from "@/components/ui/Feedback";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Icon } from "@/components/ui/Icon";

function fmtDay(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric" }).format(d);
}
function fmtMonth(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(d).replace(".", "");
}

export default async function AccountHomePage() {
  const session = await getServerSession(authOptions);
  // Le layout a deja garanti la session ; on cast en string.
  const userId = session!.user!.id as string;

  const [user, registrations] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, participantProfileCompletedAt: true },
    }),
    prisma.registration.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        rejectionReason: true,
        createdAt: true,
        event: { select: { title: true, date: true, location: true, slug: true } },
        category: { select: { name: true, color: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bonjour {user?.name}</h1>
        <p className="text-sm text-slate-600 mt-1">
          Retrouvez ici vos inscriptions et votre profil.
        </p>
      </div>

      {!user?.participantProfileCompletedAt && (
        <Alert tone="warn">
          <div>
            <p className="font-semibold">Votre profil est incomplet.</p>
            <p className="mt-0.5 text-[13px]">
              Complétez votre profil (photo, pièce d&apos;identité, structure) pour pouvoir vous inscrire à un événement.
            </p>
            <Link
              href="/account/profile/complete"
              className="mt-2 inline-flex rounded-lg bg-green-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-green-700"
            >
              Compléter mon profil
            </Link>
          </div>
        </Alert>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Mes inscriptions</h2>
        {registrations.length === 0 ? (
          <Card>
            <EmptyState
              icon="id-card"
              title="Aucune inscription"
              description="Vos inscriptions à des événements apparaîtront ici."
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {registrations.map((r) => (
              <Link
                key={r.id}
                href={`/account/registrations/${r.id}`}
                className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300"
              >
                <div className="w-14 flex-none rounded-lg border border-slate-200 bg-slate-50 py-2 text-center">
                  <div className="text-xl font-bold leading-none tabular-nums text-slate-900">{fmtDay(r.event.date)}</div>
                  <div className="mt-0.5 text-[11px] uppercase text-slate-400">{fmtMonth(r.event.date)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">{r.event.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Icon name="map-pin" size={12} /> {r.event.location}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Icon name="tag" size={12} /> {r.category.name}
                    </span>
                  </div>
                  {r.status === "REJECTED" && r.rejectionReason && (
                    <p className="mt-1 text-xs text-rose-700">Motif : {r.rejectionReason}</p>
                  )}
                </div>
                <StatusBadge status={r.status} />
                <span className="text-slate-300">
                  <Icon name="chevron-right" size={18} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
