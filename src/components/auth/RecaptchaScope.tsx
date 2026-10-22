import { getPlatformPublicRecaptcha } from "@/lib/settings";
import { RecaptchaProvider } from "@/components/auth/Recaptcha";

// Lit la configuration reCAPTCHA de la plateforme (sans le secret) et la donne aux formulaires
// publics. Les pages sont des composants client : elles ne peuvent pas lire la base elles-memes.
export async function RecaptchaScope({ children }: { children: React.ReactNode }) {
  const { recaptchaEnabled, recaptchaSiteKey } = await getPlatformPublicRecaptcha();
  return (
    <RecaptchaProvider enabled={recaptchaEnabled} siteKey={recaptchaSiteKey}>
      {children}
    </RecaptchaProvider>
  );
}
