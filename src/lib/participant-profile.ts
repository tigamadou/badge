import { prisma } from "@/lib/prisma";

export type ParticipantProfileFields = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  structure?: string | null;
  photo?: string | null;
  idDocumentType?: string | null;
  idDocumentNumber?: string | null;
  idDocument?: string | null;
};

const REQUIRED_PROFILE_KEYS = [
  "firstName",
  "lastName",
  "structure",
  "photo",
  "idDocumentType",
  "idDocumentNumber",
  "idDocument",
] as const;

export function isParticipantProfileComplete(user: ParticipantProfileFields): boolean {
  return REQUIRED_PROFILE_KEYS.every((k) => {
    const v = user[k];
    return typeof v === "string" && v.length > 0;
  });
}

export type RegistrationSnapshot = {
  snapshotFirstName: string;
  snapshotLastName: string;
  snapshotEmail: string;
  snapshotStructure: string;
  snapshotPhoto: string;
  snapshotIdDocumentType: string;
  snapshotIdDocumentNumber: string;
  snapshotIdDocument: string;
};

export function buildRegistrationSnapshot(
  user: ParticipantProfileFields,
): RegistrationSnapshot {
  if (!isParticipantProfileComplete(user) || !user.email) {
    throw new Error("buildRegistrationSnapshot : profil incomplet");
  }
  return {
    snapshotFirstName: user.firstName!,
    snapshotLastName: user.lastName!,
    snapshotEmail: user.email,
    snapshotStructure: user.structure!,
    snapshotPhoto: user.photo!,
    snapshotIdDocumentType: user.idDocumentType!,
    snapshotIdDocumentNumber: user.idDocumentNumber!,
    snapshotIdDocument: user.idDocument!,
  };
}

export function computeParticipantProfileCompletedAt(
  user: ParticipantProfileFields,
): Date | null {
  return isParticipantProfileComplete(user) ? new Date() : null;
}

// Recalcule et persiste participantProfileCompletedAt en lisant le user en BDD.
// A appeler apres toute mise a jour de profil.
export async function recomputeParticipantProfileCompletedAt(userId: string): Promise<void> {
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
      participantProfileCompletedAt: true,
    },
  });
  if (!user) return;
  const next = computeParticipantProfileCompletedAt(user);
  if (next === null && user.participantProfileCompletedAt === null) return;
  if (
    next !== null &&
    user.participantProfileCompletedAt !== null &&
    next.getTime() - user.participantProfileCompletedAt.getTime() < 1000
  ) {
    return;
  }
  await prisma.user.update({
    where: { id: userId },
    data: { participantProfileCompletedAt: next },
  });
}
