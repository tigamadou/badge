import { RecaptchaScope } from "@/components/auth/RecaptchaScope";

// La configuration reCAPTCHA vient de la base : pas de rendu statique a la construction.
export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RecaptchaScope>{children}</RecaptchaScope>;
}
