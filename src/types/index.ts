export interface Team {
  id: string;
  name: string;
  color: string;
  number: number;
  neutralBadge: boolean;
  anonymous: boolean;
}

export type RegistrationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Registration {
  id: string;
  email: string;
  photo: string;
  lastName: string;
  firstName: string;
  structure: string;
  idDocumentType: string;
  idDocumentNumber: string;
  idDocument: string;
  teamId: string;
  status: RegistrationStatus;
  allAccessGranted: boolean;
}
