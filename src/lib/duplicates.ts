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

export async function findDuplicatesForRegistration(registrationId: string): Promise<DuplicateMatch[]> {
  const ref = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      eventId: true,
      email: true,
      firstName: true,
      lastName: true,
      idDocumentNumber: true,
    },
  });
  if (!ref) return [];

  const candidates = await prisma.registration.findMany({
    where: {
      eventId: ref.eventId,
      id: { not: ref.id },
      OR: [
        { email: ref.email },
        { idDocumentNumber: ref.idDocumentNumber },
        { AND: [{ firstName: ref.firstName }, { lastName: ref.lastName }] },
      ],
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      idDocumentNumber: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return candidates.map((c) => {
    const matchedOn: ("email" | "name" | "document")[] = [];
    if (c.email === ref.email) matchedOn.push("email");
    if (c.firstName === ref.firstName && c.lastName === ref.lastName) matchedOn.push("name");
    if (c.idDocumentNumber === ref.idDocumentNumber) matchedOn.push("document");
    return { ...c, matchedOn };
  });
}
