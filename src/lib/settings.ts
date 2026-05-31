import { prisma } from "@/lib/prisma";

// Note (2026-05-31) : ResolvedSettings ne contient ni champs SMTP ni champs reCAPTCHA.
// Decision de design : SMTP et reCAPTCHA sont exclusivement geres au niveau
// PlatformSettings (pas d'override Org/Event). Voir docs/v2/features/multi-tenancy-rbac.md.
// Pour acceder au SMTP, utiliser getPlatformSmtp().
// Pour acceder au reCAPTCHA, utiliser getPlatformRecaptcha() (avec secret) ou
// getPlatformPublicRecaptcha() (sans secret, pour les Server Components publics).
export type ResolvedSettings = {
  contactEmail: string;
  contactPhone: string;
};

export type PublicSettings = ResolvedSettings;

export type PlatformSmtp = {
  smtpHost: string;
  smtpPort: number;
  smtpFrom: string;
  smtpUser: string;
  smtpPassword: string;
  smtpSecure: boolean;
};

export type PlatformRecaptcha = {
  recaptchaEnabled: boolean;
  recaptchaSiteKey: string;
  recaptchaSecretKey: string;
};

export type PublicRecaptcha = {
  recaptchaEnabled: boolean;
  recaptchaSiteKey: string;
};

function pick<T>(...candidates: (T | null | undefined)[]): T | undefined {
  for (const c of candidates) {
    if (c !== null && c !== undefined) return c;
  }
  return undefined;
}

export async function resolveSettings(
  eventId?: string,
  orgId?: string,
): Promise<ResolvedSettings> {
  let eventSettings: Awaited<ReturnType<typeof prisma.eventSettings.findUnique>> = null;
  let event: { orgId: string } | null = null;
  if (eventId) {
    eventSettings = await prisma.eventSettings.findUnique({ where: { eventId } });
    event = await prisma.event.findUnique({ where: { id: eventId }, select: { orgId: true } });
  }

  // Note (2026-05-31) : OrgSettings supprime. Le contact org est lu directement
  // depuis Organization (contactEmail, contactPhone fusionnes dans le modele).
  const effectiveOrgId = orgId ?? event?.orgId;
  let organization: { contactEmail: string | null; contactPhone: string | null } | null = null;
  if (effectiveOrgId) {
    organization = await prisma.organization.findUnique({
      where: { id: effectiveOrgId },
      select: { contactEmail: true, contactPhone: true },
    });
  }

  // Cascade Event > Org pour le contact uniquement.
  // SMTP et reCAPTCHA ne sont PAS cascades (lecture directe via getPlatformSmtp() /
  // getPlatformRecaptcha()).
  return {
    contactEmail: pick(eventSettings?.contactEmail, organization?.contactEmail) ?? "",
    contactPhone: pick(eventSettings?.contactPhone, organization?.contactPhone) ?? "",
  };
}

export async function resolvePublicSettings(
  eventId?: string,
  orgId?: string,
): Promise<PublicSettings> {
  return resolveSettings(eventId, orgId);
}

// Lecture directe du SMTP depuis PlatformSettings (pas de cascade).
// Utilise par src/lib/mail.ts pour resoudre le transporter.
export async function getPlatformSmtp(): Promise<PlatformSmtp> {
  const platform = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  if (!platform) {
    throw new Error("PlatformSettings singleton is missing. Run prisma db seed.");
  }
  return {
    smtpHost: platform.smtpHost,
    smtpPort: platform.smtpPort,
    smtpFrom: platform.smtpFrom,
    smtpUser: platform.smtpUser,
    smtpPassword: platform.smtpPassword,
    smtpSecure: platform.smtpSecure,
  };
}

// Lecture directe du reCAPTCHA depuis PlatformSettings (pas de cascade).
// Variante "publique" pour les Server Components qui rendent du HTML cote client :
// elle masque recaptchaSecretKey.
export async function getPlatformRecaptcha(): Promise<PlatformRecaptcha> {
  const platform = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  if (!platform) {
    throw new Error("PlatformSettings singleton is missing. Run prisma db seed.");
  }
  return {
    recaptchaEnabled: platform.recaptchaEnabled,
    recaptchaSiteKey: platform.recaptchaSiteKey,
    recaptchaSecretKey: platform.recaptchaSecretKey,
  };
}

export async function getPlatformPublicRecaptcha(): Promise<PublicRecaptcha> {
  const { recaptchaEnabled, recaptchaSiteKey } = await getPlatformRecaptcha();
  return { recaptchaEnabled, recaptchaSiteKey };
}
