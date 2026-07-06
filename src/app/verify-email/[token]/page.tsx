import Link from "next/link";
import Image from "next/image";

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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-5 py-10">
      <div className="w-full max-w-[400px] rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-4">
        <div className="flex justify-center mb-2">
          <Image src="/logo.png" alt="Badge" width={120} height={120} className="h-20 w-auto object-contain" />
        </div>
        {result.ok ? (
          <>
            <h1 className="text-[22px] font-semibold text-green-700">
              {result.alreadyVerified ? "Email déjà confirmé" : "Email confirmé"}
            </h1>
            <p className="text-sm text-slate-700">
              Votre adresse email est désormais vérifiée. Vous pouvez vous connecter à votre compte.
            </p>
            <Link
              href="/login"
              className="inline-block mt-2 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-green-700"
            >
              Se connecter
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-[22px] font-semibold text-red-600">Lien invalide ou expiré</h1>
            <p className="text-sm text-slate-700">
              Ce lien de confirmation est invalide ou a expiré. Vous pouvez vous inscrire à nouveau
              ou demander un nouveau lien depuis la page de connexion.
            </p>
            <div className="space-x-3">
              <Link href="/register" className="text-green-600 hover:underline text-sm">
                S&apos;inscrire à nouveau
              </Link>
              <Link href="/login" className="text-green-600 hover:underline text-sm">
                Se connecter
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
