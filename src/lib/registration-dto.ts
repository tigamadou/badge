import type { RegistrationStatus } from "@prisma/client";

// Contrat de sortie unique des listes d'inscriptions. Le prefixe `snapshot` est un
// detail de persistance : il ne doit fuiter ni dans l'API ni dans les composants.
export type RegistrationListRow = {
  id: string;
  snapshotFirstName: string;
  snapshotLastName: string;
  snapshotEmail: string;
  snapshotStructure: string;
  status: RegistrationStatus;
  badgePrinted: boolean;
  allAccessGranted: boolean;
  createdAt: Date;
  category: { id: string; name: string; color: string; number: number };
};

export type RegistrationListDTO = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  structure: string;
  status: RegistrationStatus;
  badgePrinted: boolean;
  allAccessGranted: boolean;
  createdAt: Date;
  category: { id: string; name: string; color: string; number: number };
};

export function toRegistrationListDTO(row: RegistrationListRow): RegistrationListDTO {
  return {
    id: row.id,
    firstName: row.snapshotFirstName,
    lastName: row.snapshotLastName,
    email: row.snapshotEmail,
    structure: row.snapshotStructure,
    status: row.status,
    badgePrinted: row.badgePrinted,
    allAccessGranted: row.allAccessGranted,
    createdAt: row.createdAt,
    category: row.category,
  };
}
