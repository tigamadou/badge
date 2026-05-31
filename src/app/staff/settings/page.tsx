import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PlatformSettingsForm } from "@/components/staff/PlatformSettingsForm";
import { TestSmtpForm } from "@/components/staff/TestSmtpForm";

export default async function StaffSettingsPage() {
  let s = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
  });
  if (!s) {
    s = await prisma.platformSettings.create({ data: { id: "singleton" } });
  }

  const session = await getServerSession(authOptions);

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
      <h1 className="text-2xl font-bold">Parametres plateforme</h1>
      <PlatformSettingsForm initial={safe} />
      <TestSmtpForm defaultEmail={session?.user?.email ?? undefined} />
    </div>
  );
}
