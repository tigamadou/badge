import type { ProfileStatus, ProfileSubmission } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isParticipantProfileComplete } from "@/lib/participant-profile";

export class ProfileReviewError extends Error {
  constructor(
    public code: "NO_PENDING_SUBMISSION" | "REASON_NOT_FOUND" | "REASON_WRONG_SCOPE",
    public httpStatus: number,
  ) {
    super(code);
  }
}

const PIECES_SELECT = {
  photo: true,
  idDocumentType: true,
  idDocumentNumber: true,
  idDocument: true,
} as const;

export async function getCurrentSubmission(userId: string): Promise<ProfileSubmission | null> {
  return prisma.profileSubmission.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

// Cree une soumission si les pieces du profil different de la derniere soumise.
// Renvoie null si le profil est incomplet ou si rien n'a change.
export async function submitProfile(userId: string): Promise<ProfileSubmission | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...PIECES_SELECT, firstName: true, lastName: true, structure: true },
  });
  if (!user) return null;
  if (!isParticipantProfileComplete(user)) return null;

  const current = await getCurrentSubmission(userId);
  const unchanged =
    current !== null &&
    current.photo === user.photo &&
    current.idDocumentType === user.idDocumentType &&
    current.idDocumentNumber === user.idDocumentNumber &&
    current.idDocument === user.idDocument;
  if (unchanged) return current;

  const submission = await prisma.profileSubmission.create({
    data: {
      userId,
      photo: user.photo!,
      idDocumentType: user.idDocumentType!,
      idDocumentNumber: user.idDocumentNumber!,
      idDocument: user.idDocument!,
      status: "PENDING",
    },
  });
  await prisma.user.update({ where: { id: userId }, data: { profileStatus: "PENDING" } });
  return submission;
}

async function decidePending(
  userId: string,
  data: Parameters<typeof prisma.profileSubmission.update>[0]["data"],
): Promise<ProfileSubmission> {
  const current = await getCurrentSubmission(userId);
  if (!current || current.status !== "PENDING") {
    throw new ProfileReviewError("NO_PENDING_SUBMISSION", 409);
  }
  return prisma.profileSubmission.update({ where: { id: current.id }, data });
}

export async function approveProfile(args: {
  userId: string;
  reviewerId: string;
}): Promise<ProfileSubmission> {
  const decided = await decidePending(args.userId, {
    status: "APPROVED",
    reviewedById: args.reviewerId,
    reviewedAt: new Date(),
    rejectionReasonId: null,
    rejectionReasonLabel: null,
    rejectionDetails: null,
  });
  await prisma.user.update({ where: { id: args.userId }, data: { profileStatus: "APPROVED" } });
  return decided;
}

export async function rejectProfile(args: {
  userId: string;
  reviewerId: string;
  reasonId: string;
  details?: string;
}): Promise<ProfileSubmission> {
  const reason = await prisma.rejectionReason.findFirst({
    where: { id: args.reasonId, archived: false },
  });
  if (!reason) throw new ProfileReviewError("REASON_NOT_FOUND", 400);
  if (reason.scope === "REGISTRATION") throw new ProfileReviewError("REASON_WRONG_SCOPE", 400);

  const decided = await decidePending(args.userId, {
    status: "REJECTED",
    reviewedById: args.reviewerId,
    reviewedAt: new Date(),
    rejectionReasonId: reason.id,
    rejectionReasonLabel: reason.label,
    rejectionDetails: args.details ?? null,
  });
  await prisma.user.update({ where: { id: args.userId }, data: { profileStatus: "REJECTED" } });
  return decided;
}

// v4 (plan 09) : le gate d'inscription passe de l'entree a la sortie. Deposer ses
// pieces suffit pour s'inscrire ; c'est l'approbation de l'inscription par
// l'organisation qui reste conditionnee a un profil APPROVED (cf. approve/route.ts).
// REJECTED reste bloque : le participant resoumet ses pieces, ce qui le repasse
// PENDING via submitProfile() et le debloque aussitot.
export function canRegisterToEvent(status: ProfileStatus): boolean {
  return status === "PENDING" || status === "APPROVED";
}
