import { prisma } from "@/lib/prisma";
import SetupPasswordForm from "@/components/auth/SetupPasswordForm";
import { AuthCard } from "@/components/auth/AuthCard";

type PageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

function InvalidLink() {
  return (
    <AuthCard title="Lien expiré ou invalide">
      <div className="text-center space-y-4">
        <p className="text-sm text-slate-600">
          Ce lien d&apos;invitation n&apos;est plus valide. Demandez un nouveau lien à l&apos;administrateur de votre organisation.
        </p>
        <p className="text-sm text-slate-500">Demander un nouveau lien</p>
      </div>
    </AuthCard>
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
    <AuthCard title="Configurer votre mot de passe">
      <SetupPasswordForm token={token} />
    </AuthCard>
  );
}
