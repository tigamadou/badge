import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth-participant";

export async function GET(_req: NextRequest) {
  try {
    const session = await requireAuth();
    const registrations = await prisma.registration.findMany({
      where: { userId: session.id },
      select: {
        id: true,
        status: true,
        badgePrinted: true,
        rejectionReason: true,
        createdAt: true,
        updatedAt: true,
        snapshotFirstName: true,
        snapshotLastName: true,
        snapshotEmail: true,
        eventId: true,
        event: { select: { id: true, slug: true, title: true, date: true, location: true } },
        category: { select: { id: true, name: true, color: true, number: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ registrations });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ code: err.code, error: err.message }, { status: err.httpStatus });
    }
    throw err;
  }
}
