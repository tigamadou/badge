export interface EventInfo {
  id: string;
  logo: string;
  title: string;
  location: string;
  date: string;
}

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

export interface BadgeProps {
  registration: Registration;
  team: Team;
  event: EventInfo;
}
