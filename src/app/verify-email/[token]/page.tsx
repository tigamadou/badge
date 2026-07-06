import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Alert, SuccessRing } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";

async function verifyToken(token: string, baseUrl: string): Promise<{ ok: boolean; alreadyVerified?: boolean }> {
  // Server-side fetch vers la route API pour valider le token. On utilise le
  // baseUrl du runtime pour rester compatible Docker (l'app se voit elle-meme
  // en http://localhost:3000 cote container).
  try {
    const res = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, alreadyVerified: Boolean(data?.alreadyVerified) };
  } catch {
    return { ok: false };
  }
}

function resolveBaseUrl(): string {
  return (
    process.env.BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await verifyToken(token, resolveBaseUrl());

  return result.ok ? (
    <AuthCard title={result.alreadyVerified ? "Email déjà confirmé" : "Adresse vérifiée"}>
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
