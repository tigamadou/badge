import { prisma } from "@/lib/prisma";

// URL publique de la photo de la dernière soumission APPROVED, ou null.
export async function getApprovedPhotoUrl(userId: string): Promise<string | null> {
  const submission = await prisma.profileSubmission.findFirst({
    where: { userId, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    select: { photo: true },
  });
  return submission ? `/api/files/${submission.photo}` : null;
}
