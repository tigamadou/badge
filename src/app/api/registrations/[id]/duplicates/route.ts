import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface DuplicateMatch {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  idDocumentNumber: string;
  idDocumentType: string;
  structure: string;
  status: string;
  createdAt: Date;
  team: { id: string; name: string; color: string };
  matchReasons: string[];
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "MODERATEUR")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const registration = await prisma.registration.findUnique({ where: { id } });

  if (!registration) {
    return NextResponse.json({ error: "Inscription non trouvée" }, { status: 404 });
  }

  const { firstName, lastName, email, idDocumentNumber } = registration;
  const firstNameLower = firstName.toLowerCase().trim();
  const lastNameLower = lastName.toLowerCase().trim();

  // Find all other registrations (exclude current)
  const allOthers = await prisma.registration.findMany({
    where: { id: { not: id } },
    include: { team: { select: { id: true, name: true, color: true } } },
  });

  const duplicates: DuplicateMatch[] = [];

  for (const other of allOthers) {
    const matchReasons: string[] = [];
    const otherFirstLower = other.firstName.toLowerCase().trim();
    const otherLastLower = other.lastName.toLowerCase().trim();

    // 1. Exact same ID document number
    if (
      idDocumentNumber &&
      other.idDocumentNumber &&
      idDocumentNumber.toLowerCase().trim() === other.idDocumentNumber.toLowerCase().trim()
    ) {
      matchReasons.push("Même numéro de document d'identité");
    }

    // 2. Exact same email
    if (email.toLowerCase().trim() === other.email.toLowerCase().trim()) {
      matchReasons.push("Même adresse email");
    }

    // 3. Same firstName + lastName (exact)
    if (firstNameLower === otherFirstLower && lastNameLower === otherLastLower) {
      matchReasons.push("Même nom et prénom");
    }

    // 4. Swapped firstName/lastName (prénom.nom vs nom.prénom)
    if (firstNameLower === otherLastLower && lastNameLower === otherFirstLower) {
      matchReasons.push("Nom et prénom inversés");
    }

    // 5. Email pattern match: firstName.lastName or lastName.firstName in email prefix
    const emailPrefix = other.email.toLowerCase().split("@")[0];
    const pattern1 = `${firstNameLower}.${lastNameLower}`;
    const pattern2 = `${lastNameLower}.${firstNameLower}`;
    if (emailPrefix === pattern1 || emailPrefix === pattern2) {
      if (!matchReasons.includes("Même adresse email")) {
        matchReasons.push("Email correspond au nom/prénom de cette inscription");
      }
    }

    // 6. Current registration's email prefix matches other's name
    const currentEmailPrefix = email.toLowerCase().split("@")[0];
    const otherPattern1 = `${otherFirstLower}.${otherLastLower}`;
    const otherPattern2 = `${otherLastLower}.${otherFirstLower}`;
    if (currentEmailPrefix === otherPattern1 || currentEmailPrefix === otherPattern2) {
      if (!matchReasons.includes("Même adresse email")) {
        matchReasons.push("Nom/prénom correspondent à l'email de cette inscription");
      }
    }

    if (matchReasons.length > 0) {
      duplicates.push({
        id: other.id,
        firstName: other.firstName,
        lastName: other.lastName,
        email: other.email,
        idDocumentNumber: other.idDocumentNumber,
        idDocumentType: other.idDocumentType,
        structure: other.structure,
        status: other.status,
        createdAt: other.createdAt,
        team: other.team,
        matchReasons,
      });
    }
  }

  // Sort by number of match reasons (most suspicious first)
  duplicates.sort((a, b) => b.matchReasons.length - a.matchReasons.length);

  return NextResponse.json(duplicates);
}
