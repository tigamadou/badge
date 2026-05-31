import { PrismaClient, StaffRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 1. PlatformSettings singleton — source unique pour SMTP et reCAPTCHA.
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
    },
    update: {},
  });

  // 2. Premier user SUPER_ADMIN — bootstrap de la plateforme.
  //    A changer immediatement apres le premier login via /profile.
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
      },
    });
    console.log(`SUPER_ADMIN created: ${email}`);
  } else {
    console.log(`SUPER_ADMIN already exists: ${email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
