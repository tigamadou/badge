import { prisma } from "@/lib/prisma";

export type DuplicateMatch = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  idDocumentNumber: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: Date;
  matchedOn: ("email" | "name" | "document")[];
};

// v2-11 : la duplication se calcule sur les colonnes snapshot* de la registration
// courante (qui font foi pour l'evenement) et pas sur le User actuel.
export async function findDuplicatesForRegistration(registrationId: string): Promise<DuplicateMatch[]> {
  const ref = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      eventId: true,
      snapshotEmail: true,
      snapshotFirstName: true,
      snapshotLastName: true,
      snapshotIdDocumentNumber: true,
    },
  });
  if (!ref) return [];

  const candidates = await prisma.registration.findMany({
    where: {
      eventId: ref.eventId,
      id: { not: ref.id },
      OR: [
        { snapshotEmail: ref.snapshotEmail },
        { snapshotIdDocumentNumber: ref.snapshotIdDocumentNumber },
        {
          AND: [
            { snapshotFirstName: ref.snapshotFirstName },
            { snapshotLastName: ref.snapshotLastName },
          ],
        },
      ],
    },
    select: {
      id: true,
      snapshotEmail: true,
      snapshotFirstName: true,
      snapshotLastName: true,
      snapshotIdDocumentNumber: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return candidates.map((c) => {
    const matchedOn: ("email" | "name" | "document")[] = [];
    if (c.snapshotEmail === ref.snapshotEmail) matchedOn.push("email");
    if (
      c.snapshotFirstName === ref.snapshotFirstName &&
      c.snapshotLastName === ref.snapshotLastName
    ) {
      matchedOn.push("name");
    }
    if (c.snapshotIdDocumentNumber === ref.snapshotIdDocumentNumber) matchedOn.push("document");
    return {
      id: c.id,
      email: c.snapshotEmail,
      firstName: c.snapshotFirstName,
      lastName: c.snapshotLastName,
      idDocumentNumber: c.snapshotIdDocumentNumber,
      status: c.status,
      createdAt: c.createdAt,
      matchedOn,
    };
  });
}
