import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { hasPermission, type Permission } from "@/lib/permissions";

export class AuthError extends Error {
  constructor(
    public code: "NOT_AUTHENTICATED" | "FORBIDDEN" | "ACCOUNT_BLOCKED",
    public httpStatus: 401 | 403 = 401,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

// Recupere l'utilisateur courant via la session NextAuth. Retourne null si pas connecte.
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user || typeof session.user.id !== "string") return null;
  return {
    id: session.user.id,
    email: (session.user.email as string) ?? "",
    name: (session.user.name as string) ?? "",
  };
}

// Exige une session valide. Throw AuthError(401) sinon.
export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("NOT_AUTHENTICATED", 401);
  return user;
}

// Verifie que le user courant est bien le proprietaire de la registration demandee.
// Utilise par les routes /api/account/registrations/[id]/*.
export async function requireRegistrationOwner(registrationId: string): Promise<{
  user: SessionUser;
  registration: { id: string; userId: string; status: "PENDING" | "APPROVED" | "REJECTED" };
}> {
  const user = await requireAuth();
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { id: true, userId: true, status: true },
  });
  if (!registration) throw new AuthError("FORBIDDEN", 403);
  if (registration.userId !== user.id) throw new AuthError("FORBIDDEN", 403);
  return { user, registration };
}

// Garde participant par permission (spec 37) : session valide, compte actif et non bloqué,
// puis permission effective sur la cible participant (les ajustements plateforme peuvent la retirer).
export async function requireParticipantPermission(permission: Permission): Promise<SessionUser> {
  const user = await requireAuth();
  const ctx = await loadUserContext(user.id);
  if (!ctx) throw new AuthError("NOT_AUTHENTICATED", 401);
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { blocked: true } });
  if (row.blocked) throw new AuthError("ACCOUNT_BLOCKED", 403);
  if (!hasPermission(ctx, permission, { kind: "participant" })) throw new AuthError("FORBIDDEN", 403);
  return user;
}
