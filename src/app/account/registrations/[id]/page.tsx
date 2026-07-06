import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ResubmitButton from "./ResubmitButton";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

const STATUS_LABEL: Record<"PENDING" | "APPROVED" | "REJECTED", string> = {
  PENDING: "En attente de validation",
  APPROVED: "Approuvée",
  REJECTED: "Rejetée",
};

const STATUS_COLOR: Record<"PENDING" | "APPROVED" | "REJECTED", string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REJECTED: "bg-rose-100 text-rose-800 border-rose-200",
};

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = session!.user!.id as string;

  const registration = await prisma.registration.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      badgePrinted: true,
      badgePrintedAt: true,
      rejectionReason: true,
      rejectionDetails: true,
      createdAt: true,
      updatedAt: true,
      snapshotFirstName: true,
      snapshotLastName: true,
      snapshotEmail: true,
      snapshotStructure: true,
      snapshotIdDocumentType: true,
      snapshotIdDocumentNumber: true,
      event: { select: { title: true, date: true, location: true } },
      category: { select: { name: true, color: true } },
    },
  });

  if (!registration) notFound();
  if (registration.userId !== userId) {
    redirect("/account");
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/account" className="text-sm text-green-600 hover:underline">
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">{registration.event.title}</h1>
        <p className="text-sm text-slate-600">
          {formatDate(registration.event.date)} · {registration.event.location}
        </p>
      </div>

      <div
        className={`rounded-lg border p-4 ${STATUS_COLOR[registration.status]}`}
      >
        <p className="font-semibold">{STATUS_LABEL[registration.status]}</p>
        {registration.status === "REJECTED" && (
          <div className="mt-2 space-y-1 text-sm">
            {registration.rejectionReason && (
              <p>
                <strong>Motif :</strong> {registration.rejectionReason}
              </p>
            )}
            {registration.rejectionDetails && (
              <p className="text-slate-700">{registration.rejectionDetails}</p>
            )}
          </div>
        )}
        {registration.status === "APPROVED" && registration.badgePrinted && (
          <p className="text-sm mt-1">Badge imprimé le {formatDate(registration.badgePrintedAt!)}.</p>
        )}
      </div>

      {registration.status === "REJECTED" && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <p className="text-sm text-slate-700">
            Vous pouvez corriger les informations de votre profil puis resoumettre votre inscription.
            Le snapshot soumis sera réécrit avec les valeurs actuelles de votre profil.
          </p>
          <Link href="/account/profile" className="text-sm text-green-600 underline">
            Modifier mon profil
          </Link>
          <ResubmitButton registrationId={registration.id} />
        </div>
      )}

      <section className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">
          Informations enregistrées pour cette inscription
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Catégorie</dt>
            <dd className="text-slate-900">
              <span
                className="inline-block w-3 h-3 rounded-sm mr-2 align-middle"
                style={{ backgroundColor: registration.category.color }}
              />
              {registration.category.name}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Nom</dt>
            <dd className="text-slate-900">
              {registration.snapshotFirstName} {registration.snapshotLastName}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="text-slate-900">{registration.snapshotEmail}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Structure</dt>
            <dd className="text-slate-900">{registration.snapshotStructure}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Pièce</dt>
            <dd className="text-slate-900">
              {registration.snapshotIdDocumentType} — {registration.snapshotIdDocumentNumber}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Inscrit le</dt>
            <dd className="text-slate-900">{formatDate(registration.createdAt)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
