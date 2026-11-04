import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardBody, CardHead } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Feedback";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CatPill } from "@/components/ui/Labels";
import { KeyValue } from "@/components/ui/JournalBlocks";
import { Icon } from "@/components/ui/Icon";
import { DocumentPreview } from "@/components/ui/DocumentPreview";
import ResubmitButton from "./ResubmitButton";
import { generateQRCodeDataURL } from "@/lib/qrcode";
import { registrationVerifyUrl } from "@/lib/registration-qr";
import { buildBaseUrl } from "@/lib/mail-helpers";
import { EventCover, eventCoverUrl } from "@/components/event/EventCover";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

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
      user: { select: { profileStatus: true } },
      status: true,
      categoryId: true,
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
      snapshotPhoto: true,
      snapshotIdDocument: true,
      snapshotIdDocumentType: true,
      snapshotIdDocumentNumber: true,
      event: {
        select: {
          title: true,
          date: true,
          location: true,
          banner: true,
          categories: { select: { id: true, name: true, color: true }, orderBy: { number: "asc" } },
        },
      },
      category: { select: { name: true, color: true } },
    },
  });

  if (!registration) notFound();
  if (registration.userId !== userId) {
    redirect("/account");
  }

  const welcomeQr =
    registration.status === "APPROVED"
      ? await generateQRCodeDataURL(
          registrationVerifyUrl(
            buildBaseUrl({ BASE_URL: process.env.BASE_URL, NEXTAUTH_URL: process.env.NEXTAUTH_URL }),
            registration.id,
          ),
        )
      : null;

  return (
    <div className="space-y-6">
      <EventCover
        bannerUrl={eventCoverUrl(registration.event.banner)}
        title={registration.event.title}
        variant="hero"
      />
      <div>
        <Link href="/account" className="inline-flex items-center gap-1 text-sm text-navy hover:underline">
          <Icon name="arrow-left" size={14} /> Retour
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-navy">{registration.event.title}</h1>
          <StatusBadge status={registration.status} />
        </div>
        <p className="text-sm text-slate-600">
          {formatDate(registration.event.date)} · {registration.event.location}
        </p>
      </div>

      {registration.status === "PENDING" && registration.user.profileStatus !== "APPROVED" && (
        <Alert tone="warn">
          <div>
            <p className="font-semibold">Inscription en attente de validation du profil</p>
            <p className="mt-1 text-[13px]">
              Vos pièces sont en cours de vérification par la plateforme. Votre inscription sera examinée
              par l&apos;organisateur une fois cette vérification terminée.{" "}
              <Link href="/account/profile" className="text-navy underline">
                Voir mon profil
              </Link>
            </p>
          </div>
        </Alert>
      )}

      {registration.status === "APPROVED" && registration.badgePrinted && (
        <Alert tone="success">
          <Icon name="check" size={16} /> Badge imprimé le {formatDate(registration.badgePrintedAt!)}.
        </Alert>
      )}

      {welcomeQr && (
        <Card>
          <CardHead title="QR d'accueil" />
          <CardBody className="flex flex-col items-center gap-2 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={welcomeQr} alt="QR d'accueil" width={200} height={200} />
            <p className="font-mono text-sm text-slate-900">{registration.id}</p>
            <p className="text-sm text-slate-600">À présenter à l&apos;accueil, sur votre téléphone ou imprimé.</p>
          </CardBody>
        </Card>
      )}

      {registration.status === "REJECTED" && (
        <Card>
          <CardBody className="space-y-3">
            <Alert tone="err">
              <div>
                <p className="font-semibold">Inscription rejetée</p>
                {registration.rejectionReason && (
                  <p className="mt-1 text-[13px]">Motif : {registration.rejectionReason}</p>
                )}
                {registration.rejectionDetails && (
                  <p className="mt-0.5 text-[13px]">{registration.rejectionDetails}</p>
                )}
              </div>
            </Alert>
            <p className="text-sm text-slate-600">
              Vous pouvez corriger les informations de votre profil ou choisir une autre catégorie, puis resoumettre
              votre inscription. Le snapshot soumis sera réécrit avec les valeurs actuelles de votre profil.
            </p>
            <Link href="/account/profile" className="inline-block text-sm text-navy hover:underline">
              Modifier mon profil
            </Link>
            <ResubmitButton
              registrationId={registration.id}
              currentCategoryId={registration.categoryId}
              categories={registration.event.categories}
            />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHead title="Informations enregistrées pour cette inscription" />
        <CardBody>
          <KeyValue
            items={[
              {
                label: "Catégorie",
                value: <CatPill color={registration.category.color} label={registration.category.name} />,
              },
              { label: "Nom", value: `${registration.snapshotFirstName} ${registration.snapshotLastName}` },
              { label: "E-mail", value: registration.snapshotEmail },
              { label: "Structure", value: registration.snapshotStructure },
              {
                label: "Pièce",
                value: `${registration.snapshotIdDocumentType} — ${registration.snapshotIdDocumentNumber}`,
              },
              { label: "Inscrit le", value: formatDate(registration.createdAt) },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Pièces fournies" />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DocumentPreview storageKey={registration.snapshotPhoto} label="Photo" />
            <DocumentPreview storageKey={registration.snapshotIdDocument} label="Pièce d'identité" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
