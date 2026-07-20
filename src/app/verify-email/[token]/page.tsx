import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Alert, SuccessRing } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";
import { consumeEmailVerifyToken } from "@/lib/verify-email";

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // Appel direct du helper (pas de self-fetch HTTP : NEXTAUTH_URL n'est pas
  // joignable depuis le container, ce qui cassait la verification en dev/test).
  const result = await consumeEmailVerifyToken(token);
  const ok = result.status === "verified" || result.status === "already-verified";
  const alreadyVerified = result.status === "already-verified";

  return ok ? (
    <AuthCard title={alreadyVerified ? "Email déjà confirmé" : "Adresse vérifiée"}>
      <div className="text-center">
        <SuccessRing>
          <Icon name="check" size={34} />
        </SuccessRing>
        <p className="text-sm text-slate-600">
          Votre adresse e-mail a bien été confirmée. Vous pouvez maintenant vous connecter.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
        >
          Se connecter
        </Link>
      </div>
    </AuthCard>
  ) : (
    <AuthCard title="Lien invalide ou expiré">
      <div className="space-y-4 text-center">
        <Alert tone="err">Ce lien de confirmation est invalide ou a expiré.</Alert>
        <div className="flex justify-center gap-4 text-sm">
          <Link href="/register" className="text-green-600 hover:underline">
            S&apos;inscrire à nouveau
          </Link>
          <Link href="/login" className="text-green-600 hover:underline">
            Se connecter
          </Link>
        </div>
      </div>
    </AuthCard>
  );
}
