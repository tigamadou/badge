import { NextResponse } from "next/server";
import { Prisma, ProfileStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";

const VALID_STATUS = new Set<string>(["INCOMPLETE", "PENDING", "APPROVED", "REJECTED"]);

export const GET = withStaffAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDING";
  if (!VALID_STATUS.has(status)) {
    return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
  }
  const q = searchParams.get("q")?.trim();

  const where: Prisma.UserWhereInput = {
    isStaff: false,
    profileStatus: status as ProfileStatus,
  };
  if (q) {
    where.OR = [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { email: { contains: q } },
      { idDocumentNumber: { contains: q } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      structure: true,
      profileStatus: true,
      idDocumentType: true,
      idDocumentNumber: true,
    },
  });
  return NextResponse.json({ users });
});
