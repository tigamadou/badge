import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user!.id as string;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      structure: true,
      photo: true,
      idDocumentType: true,
      idDocumentNumber: true,
      idDocument: true,
      participantProfileCompletedAt: true,
    },
  });

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mon profil</h1>
        <p className="text-sm text-slate-600 mt-1">
          Ces informations sont enregistrées sur votre compte et utilisées pour vos inscriptions.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
        <p>
          <strong>Email :</strong> {user.email}{" "}
          <span className="text-xs text-slate-500">(non modifiable)</span>
        </p>
        <p className="mt-1">
          <strong>Nom du compte :</strong> {user.name}
        </p>
        {user.participantProfileCompletedAt ? (
          <p className="text-emerald-700 mt-1">Profil complet ✓</p>
        ) : (
          <p className="text-amber-700 mt-1">
            Profil incomplet : complétez tous les champs ci-dessous pour pouvoir vous inscrire.
          </p>
        )}
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
      />
    </div>
  );
}
