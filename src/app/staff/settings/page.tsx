import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PlatformSettingsForm } from "@/components/staff/PlatformSettingsForm";
import { TestSmtpForm } from "@/components/staff/TestSmtpForm";
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
    </div>
  );
}
