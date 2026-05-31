import Script from "next/script";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolvePublicSettings, getPlatformPublicRecaptcha } from "@/lib/settings";
import { PublicEventLayout } from "@/components/public/PublicEventLayout";
import { EditRegistrationForm } from "@/components/public/EditRegistrationForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reg = await prisma.registration.findUnique({
    where: { editToken: token },
    include: { event: true },
  });
  if (!reg) redirect("/edit-registration/expired?reason=NOT_FOUND");
  if (!reg.editTokenExpiresAt || reg.editTokenExpiresAt < new Date()) {
    redirect(`/edit-registration/expired?token=${encodeURIComponent(token)}`);
  }

  const categories = await prisma.category.findMany({
    where: { eventId: reg.eventId },
    orderBy: { number: "asc" },
  });
  const settings = await resolvePublicSettings(reg.eventId);
  const recaptcha = await getPlatformPublicRecaptcha();

  return (
    <PublicEventLayout
      event={reg.event}
      contact={{ email: settings.contactEmail, phone: settings.contactPhone }}
    >
      {recaptcha.recaptchaEnabled && recaptcha.recaptchaSiteKey && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${recaptcha.recaptchaSiteKey}`}
          strategy="afterInteractive"
        />
      )}
      <EditRegistrationForm
        token={token}
        slug={reg.event.slug}
        categories={categories}
        settings={recaptcha}
        initial={{
          email: reg.email,
          firstName: reg.firstName,
          lastName: reg.lastName,
          structure: reg.structure,
          categoryId: reg.categoryId,
          idDocumentType: reg.idDocumentType,
          idDocumentNumber: reg.idDocumentNumber,
          photo: reg.photo,
          idDocument: reg.idDocument,
          rejectionReason: reg.rejectionReason,
          rejectionDetails: reg.rejectionDetails,
        }}
      />
    </PublicEventLayout>
  );
}
