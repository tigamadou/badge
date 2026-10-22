import { prisma } from "@/lib/prisma";

// Les routes protegees par reCAPTCHA lisent la configuration de la plateforme. Les tests simulent
// `verifyRecaptcha` : seules les valeurs transmises (cle secrete, activation) comptent.
export async function seedRecaptchaPlatform(enabled = true) {
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      smtpHost: "localhost",
      smtpPort: 587,
      smtpFrom: "noreply@recaptcha.test",
      smtpUser: "",
      smtpPassword: "",
      smtpSecure: false,
      recaptchaEnabled: enabled,
      recaptchaSiteKey: "site-key",
      recaptchaSecretKey: "secret-key",
    },
    update: { recaptchaEnabled: enabled, recaptchaSiteKey: "site-key", recaptchaSecretKey: "secret-key" },
  });
}

// La base est partagee avec les tests suivants et les e2e locaux : reCAPTCHA redevient inactif.
export async function clearRecaptchaPlatform() {
  await prisma.platformSettings.updateMany({
    data: { recaptchaEnabled: false, recaptchaSiteKey: "", recaptchaSecretKey: "" },
  });
}
