import type { StaffRole, OrgRole, EventRole } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  isStaff: boolean;
};

export type OrgMembershipLite = { orgId: string; role: OrgRole };
export type EventMembershipLite = { eventId: string; role: EventRole };

export type UserContext = {
  user: { id: string; email: string; name: string };
  isStaff: boolean;
  staffRole: StaffRole | null;
  orgMemberships: OrgMembershipLite[];
  eventMemberships: EventMembershipLite[];
};

export type EffectiveEventRole = EventRole | "STAFF" | null;
