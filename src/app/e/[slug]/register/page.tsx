import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadPublicEventBySlug, PublicEventError } from "@/lib/public-event";
import { PublicEventLayout } from "@/components/public/PublicEventLayout";
import { isParticipantProfileComplete } from "@/lib/participant-profile";
import { ClosedView } from "../closed";
import RegisterEventForm from "./RegisterEventForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EventRegisterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/e/${slug}/register`);
  }

  let bundle;
  try {
    bundle = await loadPublicEventBySlug(slug);
  } catch (err) {
    if (err instanceof PublicEventError) {
      if (err.code === "NOT_FOUND") notFound();
      return (
        <main className="mx-auto max-w-md p-8">
          <ClosedView reason="CLOSED" />
        </main>
      );
    }
    throw err;
  }

  const { event, categories, settings } = bundle;
  const userId = session.user.id as string;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      structure: true,
      photo: true,
      idDocumentType: true,
      idDocumentNumber: true,
      idDocument: true,
    },
  });

  if (!user || !isParticipantProfileComplete(user)) {
    redirect(`/account/profile/complete?next=/e/${slug}/register`);
  }

  const existing = await prisma.registration.findUnique({
    where: { userId_eventId: { userId, eventId: event.id } },
    select: { id: true, status: true },
  });

  return (
    <PublicEventLayout
      event={event}
      contact={{ email: settings.contactEmail, phone: settings.contactPhone }}
    >
      <div className="rounded-lg border bg-white p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">
            Confirmer mon inscription
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Votre profil est complet. Sélectionnez votre catégorie pour valider l&apos;inscription.
          </p>
        </div>

        {existing ? (
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
            <p>Vous êtes déjà inscrit à cet événement.</p>
            <Link
              href={`/account/registrations/${existing.id}`}
              className="mt-1 inline-block text-indigo-700 underline"
            >
              Voir le détail de mon inscription
            </Link>
          </div>
        ) : (
          <RegisterEventForm slug={slug} categories={categories} />
        )}
      </div>
    </PublicEventLayout>
  );
}
