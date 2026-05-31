import { prisma } from "@/lib/prisma";
import SetupPasswordForm from "@/components/auth/SetupPasswordForm";

type PageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

function InvalidLink() {
  return (
    <div className="bg-slate-50 min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-6 text-center space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">
          Lien expire ou invalide
        </h1>
        <p className="text-sm text-slate-600">
          Ce lien d&apos;invitation n&apos;est plus valide. Demandez un nouveau lien a l&apos;administrateur de votre organisation.
        </p>
        <p className="text-sm text-slate-500">Demander un nouveau lien</p>
      </div>
    </div>
  );
}

export default async function SetupPasswordPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const rawToken = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const token = typeof rawToken === "string" ? rawToken.trim() : "";

  if (!token) {
    return <InvalidLink />;
  }

  const user = await prisma.user.findUnique({
    where: { inviteToken: token },
    select: { id: true, inviteTokenExpiry: true, archived: true },
  });

  if (
    !user ||
    !user.inviteTokenExpiry ||
    user.inviteTokenExpiry < new Date() ||
    user.archived
  ) {
    return <InvalidLink />;
  }

  return (
    <div className="bg-slate-50 min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-6">
        <h1 className="text-xl font-semibold text-slate-900 mb-6 text-center">
          Configurer votre mot de passe
        </h1>
        <SetupPasswordForm token={token} />
      </div>
    </div>
  );
}
