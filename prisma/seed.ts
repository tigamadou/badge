import { PrismaClient, StaffRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 1. PlatformSettings singleton -- source unique pour SMTP et reCAPTCHA.
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      smtpHost: process.env.PLATFORM_SMTP_HOST || "mailpit",
      smtpPort: parseInt(process.env.PLATFORM_SMTP_PORT || "1025", 10),
      smtpFrom: process.env.PLATFORM_SMTP_FROM || "noreply@badge.local",
      smtpUser: process.env.PLATFORM_SMTP_USER || "",
      smtpPassword: process.env.PLATFORM_SMTP_PASSWORD || "",
      smtpSecure: process.env.PLATFORM_SMTP_SECURE === "true",
      recaptchaEnabled: process.env.RECAPTCHA_SECRET_KEY ? true : false,
      recaptchaSiteKey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "",
      recaptchaSecretKey: process.env.RECAPTCHA_SECRET_KEY || "",
      // v2-12 : template par defaut absolu (racine de la cascade).
      badgeTemplateId: "default-v1",
    },
    update: {},
  });

  // 2. Premier user SUPER_ADMIN -- bootstrap de la plateforme.
  //    A changer immediatement apres le premier login via /profile.
  //    v2-11 : emailVerifiedAt pose des le seed pour autoriser le login NextAuth
  //    (authorize refuse les comptes !emailVerifiedAt depuis v2-11).
  const email = process.env.SEED_SUPER_ADMIN_EMAIL || "admin@badge.local";
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD || "admin123";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        password: await hash(password, 12),
        name: "Super Admin",
        isStaff: true,
        staffRole: StaffRole.SUPER_ADMIN,
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`SUPER_ADMIN created: ${email}`);
  } else if (!existing.emailVerifiedAt) {
    // Backfill v2-11 : autorise le login pour un super-admin seede avant ce plan.
    await prisma.user.update({
      where: { id: existing.id },
      data: { emailVerifiedAt: new Date() },
    });
    console.log(`SUPER_ADMIN emailVerifiedAt backfilled: ${email}`);
  } else {
    console.log(`SUPER_ADMIN already exists: ${email}`);
  }

  // 3. v2-11 : user participant de demonstration avec profil complet.
  //    Email verifie pour permettre le login direct. Profil complet pour
  //    pouvoir tester le flux /e/[slug]/register sans passer par
  //    /account/profile/complete.
  const partEmail = process.env.SEED_PARTICIPANT_EMAIL || "participant@badge.local";
  const partPassword = process.env.SEED_PARTICIPANT_PASSWORD || "particip123";
  const partExisting = await prisma.user.findUnique({ where: { email: partEmail } });
  if (!partExisting) {
    const now = new Date();
    await prisma.user.create({
      data: {
        email: partEmail,
        password: await hash(partPassword, 12),
        name: "Awa Diallo",
        isStaff: false,
        emailVerifiedAt: now,
        firstName: "Awa",
        lastName: "Diallo",
        structure: "Universite Felix Houphouet-Boigny",
        photo: "uploads/profile/seed/awa-photo.jpg",
        idDocumentType: "CNI",
        idDocumentNumber: "CI-AWA-001",
        idDocument: "uploads/profile/seed/awa-cni.pdf",
        participantProfileCompletedAt: now,
      },
    });
    console.log(`Participant created: ${partEmail}`);
  } else {
    console.log(`Participant already exists: ${partEmail}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
