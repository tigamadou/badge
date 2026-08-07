import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PlatformSettingsForm } from "@/components/staff/PlatformSettingsForm";
import { TestSmtpForm } from "@/components/staff/TestSmtpForm";
import { RejectionReasonsManager } from "@/components/staff/RejectionReasonsManager";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";

export default async function StaffSettingsPage() {
  let s = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
  });
  if (!s) {
    s = await prisma.platformSettings.create({ data: { id: "singleton" } });
  }

  const session = await getServerSession(authOptions);

  // Determiner si l'utilisateur courant peut editer les secrets (smtpPassword,
  // recaptchaSecretKey). Garde-fou ADR 2026-06-01 : reserve SUPER_ADMIN.
  let canEditSecrets = false;
  if (session?.user?.id) {
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { staffRole: true },
    });
    canEditSecrets = me?.staffRole === "SUPER_ADMIN";
  }

  // v4 (plan 08) : la gestion du catalogue de motifs est reservee STAFF_ADMIN+.
  let canManageReasons = false;
  if (session?.user?.id) {
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { staffRole: true },
    });
    canManageReasons = me?.staffRole === "SUPER_ADMIN" || me?.staffRole === "STAFF_ADMIN";
  }

  const rejectionReasons = await prisma.rejectionReason.findMany({
    where: { archived: false },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { id: true, label: true, scope: true, sortOrder: true },
  });

  // Construction de la vue publique : on ne passe JAMAIS les valeurs secretes au
  // composant client. Les booleans *Set indiquent simplement leur presence.
  const safe = {
    smtpHost: s.smtpHost,
    smtpPort: s.smtpPort,
    smtpFrom: s.smtpFrom,
    smtpUser: s.smtpUser,
    smtpSecure: s.smtpSecure,
    smtpPasswordSet: !!s.smtpPassword,
    recaptchaEnabled: s.recaptchaEnabled,
    recaptchaSiteKey: s.recaptchaSiteKey,
    recaptchaSecretKeySet: !!s.recaptchaSecretKey,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Paramètres plateforme</h1>
        <p className="mt-0.5 text-sm text-slate-400">Configuration globale — SMTP, reCAPTCHA</p>
      </div>
      <Alert tone="info">
        <Icon name="shield" size={16} /> Ces paramètres s&apos;appliquent à toute la plateforme et sont réservés au
        staff.
      </Alert>
      <PlatformSettingsForm initial={safe} canEditSecrets={canEditSecrets} />
      <TestSmtpForm defaultEmail={session?.user?.email ?? undefined} />

      <Card>
        <CardHead
          title="Motifs de rejet"
          subtitle="Catalogue partagé par la validation des profils et le rejet des inscriptions"
        />
        <CardBody>
          <RejectionReasonsManager initial={rejectionReasons} canManage={canManageReasons} />
        </CardBody>
      </Card>
    </div>
  );
}
