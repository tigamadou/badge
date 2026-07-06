import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProfileForm from "../ProfileForm";

export default async function ProfileCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const session = await getServerSession(authOptions);
  const userId = session!.user!.id as string;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      structure: true,
      photo: true,
      idDocumentType: true,
      idDocumentNumber: true,
      idDocument: true,
    },
  });

  if (!user) return null;

  // Redirection apres save uniquement vers une URL interne (next commencant par "/").
  const safeNext = next && next.startsWith("/") ? next : "/account";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Compléter votre profil</h1>
        <p className="text-sm text-slate-600 mt-1">
          Avant de pouvoir vous inscrire à un événement, nous avons besoin de quelques informations
          obligatoires (identité, structure, photo, pièce d&apos;identité). Ces données seront utilisées
          uniquement pour vos badges.
        </p>
      </div>

      <ProfileForm
        initial={{
          firstName: user.firstName,
          lastName: user.lastName,
          structure: user.structure,
          photo: user.photo,
          idDocumentType: user.idDocumentType,
          idDocumentNumber: user.idDocumentNumber,
          idDocument: user.idDocument,
        }}
        redirectTo={safeNext}
      />
    </div>
  );
}
