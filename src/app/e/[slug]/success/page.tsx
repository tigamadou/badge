import { prisma } from "@/lib/prisma";
import { resolvePublicSettings } from "@/lib/settings";
import { PublicEventLayout } from "@/components/public/PublicEventLayout";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SuccessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event) notFound();
  const settings = await resolvePublicSettings(event.id);
  return (
    <PublicEventLayout event={event} contact={{ email: settings.contactEmail, phone: settings.contactPhone }}>
      <div className="rounded-lg border bg-white p-6 text-center">
        <h2 className="text-xl font-semibold text-neutral-900">Votre inscription a bien été enregistrée.</h2>
        <p className="mt-2 text-sm text-neutral-700">
          Un email de confirmation vient de vous être envoyé. Conservez-le précieusement.
        </p>
        {settings.contactEmail && (
          <p className="mt-2 text-sm text-neutral-500">
            Pour toute question : <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
          </p>
        )}
      </div>
    </PublicEventLayout>
  );
}
