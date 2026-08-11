import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePublicSettings } from "@/lib/settings";
import { PublicEventLayout } from "@/components/public/PublicEventLayout";
import { Card, CardBody } from "@/components/ui/Card";
import { SuccessRing } from "@/components/ui/Feedback";
import { FileBox } from "@/components/ui/FileBox";
import { Icon } from "@/components/ui/Icon";

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

  // v4 (plan 09) : l'inscription est desormais possible avant validation des pieces.
  // On le rappelle ici, sinon le participant croit n'avoir plus rien a attendre.
  const session = await getServerSession(authOptions);
  const profileStatus = session?.user?.id
    ? (
        await prisma.user.findUnique({
          where: { id: session.user.id as string },
          select: { profileStatus: true },
        })
      )?.profileStatus
    : undefined;

  return (
    <PublicEventLayout event={event} contact={{ email: settings.contactEmail, phone: settings.contactPhone }}>
      <Card>
        <CardBody className="text-center">
          <SuccessRing>
            <Icon name="check" size={36} />
          </SuccessRing>
          <h2 className="text-2xl font-semibold text-slate-900">Inscription enregistrée</h2>
          <p className="mx-auto mt-2 max-w-[440px] text-sm text-slate-600">
            Votre inscription a bien été reçue et est en cours de vérification. Un e-mail de confirmation vient de vous
            être envoyé.
          </p>
          {profileStatus === "PENDING" && (
            <p className="mx-auto mt-3 max-w-[440px] text-sm text-sky-700">
              Vos pièces d&apos;identité sont en cours de vérification par la plateforme. Votre inscription
              sera examinée par l&apos;organisateur une fois cette vérification terminée.
            </p>
          )}
          <div className="my-6 border-t border-slate-100" />
          <div className="flex flex-wrap justify-center gap-4 text-left">
            <FileBox icon="clock" title="Statut : en attente" subtitle="Vous serez notifié dès traitement" />
            {id && <FileBox icon="id-card" title="Inscription enregistrée" subtitle={`N° ${id}`} />}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {id && (
              <Link
                href={`/account/registrations/${id}`}
                className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Voir le détail
              </Link>
            )}
            <Link
              href="/account"
              className="inline-flex items-center rounded-lg border border-green-600 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
            >
              Mon compte
            </Link>
          </div>
          {settings.contactEmail && (
            <p className="mt-6 text-sm text-slate-400">
              Pour toute question :{" "}
              <a href={`mailto:${settings.contactEmail}`} className="text-green-600 hover:underline">
                {settings.contactEmail}
              </a>
            </p>
          )}
        </CardBody>
      </Card>
    </PublicEventLayout>
  );
}
