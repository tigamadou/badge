import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

const STATUS_LABEL: Record<"PENDING" | "APPROVED" | "REJECTED", string> = {
  PENDING: "En attente",
  APPROVED: "Approuvée",
  REJECTED: "Rejetée",
};

const STATUS_COLOR: Record<"PENDING" | "APPROVED" | "REJECTED", string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
};

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
        <h1 className="text-2xl font-bold text-gray-900">Bonjour {user?.name}</h1>
        <p className="text-sm text-gray-600 mt-1">
          Retrouvez ici vos inscriptions et votre profil.
        </p>
      </div>

      {!user?.participantProfileCompletedAt && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4">
          <p className="font-semibold mb-1">Votre profil est incomplet.</p>
          <p className="text-sm">
            Complétez votre profil (photo, pièce d&apos;identité, structure) pour pouvoir vous
            inscrire à un événement.
          </p>
          <Link
            href="/account/profile/complete"
            className="inline-block mt-3 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-semibold"
          >
            Compléter mon profil
          </Link>
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Mes inscriptions</h2>
        {registrations.length === 0 ? (
          <p className="text-sm text-gray-600 bg-white rounded-lg border border-gray-200 p-6">
            Vous n&apos;avez pas encore d&apos;inscription. Visitez la page d&apos;un événement pour
            vous inscrire.
          </p>
        ) : (
          <ul className="space-y-3">
            {registrations.map((r) => (
              <li
                key={r.id}
                className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="font-semibold text-gray-900">{r.event.title}</p>
                  <p className="text-sm text-gray-600">
                    {formatDate(r.event.date)} · {r.event.location} · {r.category.name}
                  </p>
                  {r.status === "REJECTED" && r.rejectionReason && (
                    <p className="text-xs text-rose-700 mt-1">Motif : {r.rejectionReason}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded ${STATUS_COLOR[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                  <Link
                    href={`/account/registrations/${r.id}`}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    Détail
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
