import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth-participant";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const registration = await prisma.registration.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        badgePrinted: true,
        badgePrintedAt: true,
        allAccessGranted: true,
        rejectionReason: true,
        rejectionDetails: true,
        createdAt: true,
        updatedAt: true,
        snapshotFirstName: true,
        snapshotLastName: true,
        snapshotEmail: true,
        snapshotStructure: true,
        snapshotPhoto: true,
        snapshotIdDocumentType: true,
        snapshotIdDocumentNumber: true,
        snapshotIdDocument: true,
        eventId: true,
        event: { select: { id: true, slug: true, title: true, date: true, location: true } },
        category: { select: { id: true, name: true, color: true, number: true } },
      },
    });
    if (!registration) {
      return NextResponse.json({ code: "NOT_FOUND", error: "Inscription introuvable." }, { status: 404 });
    }
    if (registration.userId !== session.id) {
      return NextResponse.json({ code: "FORBIDDEN", error: "Accès refusé." }, { status: 403 });
    }
    return NextResponse.json({ registration });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ code: err.code, error: err.message }, { status: err.httpStatus });
    }
    throw err;
  }
}
