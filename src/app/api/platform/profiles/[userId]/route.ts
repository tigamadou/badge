import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";

type Params = { userId: string };

export const GET = withStaffAuth<Params>(async (_req, _ctx, extra) => {
  const { userId } = await extra.params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      structure: true,
      profileStatus: true,
      photo: true,
      idDocumentType: true,
      idDocumentNumber: true,
      idDocument: true,
      isStaff: true,
    },
  });
  if (!user || user.isStaff) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const submissions = await prisma.profileSubmission.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      photo: true,
      idDocumentType: true,
      idDocumentNumber: true,
      idDocument: true,
      status: true,
      rejectionReasonLabel: true,
      rejectionDetails: true,
      reviewedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user, submissions });
}, { permission: "profiles.read" });
