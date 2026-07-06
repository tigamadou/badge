import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolvePublicSettings } from "@/lib/settings";
import { PublicEventLayout } from "@/components/public/PublicEventLayout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { slug } = await params;
  const { id } = await searchParams;
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event) notFound();
  const settings = await resolvePublicSettings(event.id);
  return (
    <PublicEventLayout event={event} contact={{ email: settings.contactEmail, phone: settings.contactPhone }}>
      <div className="rounded-lg border bg-white p-6 text-center space-y-3">
        <h2 className="text-xl font-semibold text-neutral-900">Votre inscription a bien été enregistrée.</h2>
        <p className="text-sm text-neutral-700">
          Un email de confirmation vient de vous être envoyé. Vous serez notifié dès qu&apos;elle aura
          été traitée.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {id && (
            <Link
              href={`/account/registrations/${id}`}
              className="inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              Voir le détail de mon inscription
            </Link>
          )}
          <Link
            href="/account"
            className="inline-flex items-center justify-center rounded-md border border-green-600 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50"
          >
            Mon compte
          </Link>
        </div>
        {settings.contactEmail && (
          <p className="text-sm text-neutral-500">
            Pour toute question : <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
          </p>
        )}
      </div>
    </PublicEventLayout>
  );
}
