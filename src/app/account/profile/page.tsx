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
      profileStatus: true,
    },
  });

  if (!user) return null;

  const submissions = await prisma.profileSubmission.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      rejectionReasonLabel: true,
      rejectionDetails: true,
      reviewedAt: true,
      createdAt: true,
    },
  });

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
        {user.profileStatus === "INCOMPLETE" && (
          <p className="text-warn mt-1">
            Profil incomplet : complétez tous les champs ci-dessous pour pouvoir vous inscrire.
          </p>
        )}
        {user.profileStatus === "PENDING" && (
          <p className="text-gold-strong mt-1">
            Vos documents sont en cours de vérification par la plateforme. Vous pourrez vous inscrire à un
            événement une fois votre profil validé.
          </p>
        )}
        {user.profileStatus === "APPROVED" && (
          <p className="text-turquoise-strong mt-1">Profil validé — vous pouvez vous inscrire aux événements.</p>
        )}
        {user.profileStatus === "REJECTED" && (
          <p className="text-rose-700 mt-1">
            Documents refusés
            {submissions[0]?.rejectionReasonLabel ? ` : ${submissions[0].rejectionReasonLabel}` : ""}
            {submissions[0]?.rejectionDetails ? ` — ${submissions[0].rejectionDetails}` : ""}. Corrigez-les puis
            enregistrez pour soumettre à nouveau.
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

      {submissions.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Historique de mes soumissions</h2>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {submissions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-slate-700">
                  {s.status === "APPROVED" ? "Validé" : s.status === "REJECTED" ? "Rejeté" : "En attente"}
                  {s.rejectionReasonLabel ? ` — ${s.rejectionReasonLabel}` : ""}
                  {s.rejectionDetails ? ` (${s.rejectionDetails})` : ""}
                </span>
                <span className="text-xs tabular-nums text-slate-400">
                  Soumis le {new Date(s.createdAt).toLocaleDateString("fr-FR")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
