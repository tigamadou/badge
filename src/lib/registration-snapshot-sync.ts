import { prisma } from "@/lib/prisma";
import {
  buildRegistrationSnapshot,
  isParticipantProfileComplete,
  type RegistrationSnapshot,
} from "@/lib/participant-profile";

// v4 (plan 15) : le gel des colonnes snapshot* ne vaut que pour les inscriptions
// validees. Tant qu'une inscription est en attente, elle suit le profil.
export type SnapshotRefreshOutcome =
  | {
      registrationId: string;
      eventId: string;
      orgId: string;
      outcome: "refreshed";
      fields: string[];
    }
  | {
      registrationId: string;
      eventId: string;
      orgId: string;
      outcome: "skipped_document_blocked";
    };

const SNAPSHOT_KEYS = [
  "snapshotFirstName",
  "snapshotLastName",
  "snapshotEmail",
  "snapshotStructure",
  "snapshotPhoto",
  "snapshotIdDocumentType",
  "snapshotIdDocumentNumber",
  "snapshotIdDocument",
] as const;

function changedFields(
  current: Record<string, unknown>,
  target: RegistrationSnapshot,
): string[] {
  return SNAPSHOT_KEYS.filter((k) => current[k] !== target[k]);
}

export async function refreshPendingRegistrationSnapshots(
  userId: string,
): Promise<SnapshotRefreshOutcome[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      structure: true,
      photo: true,
      idDocumentType: true,
      idDocumentNumber: true,
      idDocument: true,
    },
  });
  // Garde defensive : le schema de mise a jour du profil refuse les valeurs vides,
  // un profil complet ne peut donc pas le redevenir. On ne suppose rien pour autant.
  if (!user || !isParticipantProfileComplete(user)) return [];

  const target = buildRegistrationSnapshot(user);

  const registrations = await prisma.registration.findMany({
    where: { userId, status: "PENDING", event: { archived: false } },
    select: {
      id: true,
      eventId: true,
      event: { select: { orgId: true } },
      snapshotFirstName: true,
      snapshotLastName: true,
      snapshotEmail: true,
      snapshotStructure: true,
      snapshotPhoto: true,
      snapshotIdDocumentType: true,
      snapshotIdDocumentNumber: true,
      snapshotIdDocument: true,
    },
  });

  const outcomes: SnapshotRefreshOutcome[] = [];

  for (const registration of registrations) {
    const fields = changedFields(registration, target);
    if (fields.length === 0) continue;

    await prisma.registration.update({ where: { id: registration.id }, data: target });
    outcomes.push({
      registrationId: registration.id,
      eventId: registration.eventId,
      orgId: registration.event.orgId,
      outcome: "refreshed",
      fields,
    });
  }

  return outcomes;
}
