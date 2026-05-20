import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import crypto from "crypto";
import { sendUserInvitation, getContactInfo, areContactsConfigured } from "@/lib/mail";
import { logActivity } from "@/lib/activity-log";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  const where = { role: { not: "SUPER_ADMIN" } } as const;

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({ data: users, total, page, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { email, name, role } = await req.json();
  if (!email || !name || !role) {
    return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
  }

  const contacts = await getContactInfo();
  if (!areContactsConfigured(contacts)) {
    return NextResponse.json(
      { error: "Veuillez configurer les informations de contact (email, téléphone, site web) dans les paramètres." },
      { status: 400 }
    );
  }

  const inviteToken = crypto.randomUUID();
  const inviteTokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const tempPassword = await hash(crypto.randomUUID(), 12);

  const user = await prisma.user.create({
    data: {
      email,
      password: tempPassword,
      name,
      role,
      inviteToken,
      inviteTokenExpiry,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  const baseUrl = process.env.NEXTAUTH_URL || process.env.BASE_URL || "http://localhost:3000";
  const setupUrl = `${baseUrl}/setup-password?token=${inviteToken}`;
  sendUserInvitation(email, name, setupUrl).catch(console.error);

  await logActivity({
    type: "USER_CREATED",
    userId: session.user.id,
    targetId: user.id,
    details: { userName: name, userEmail: email, userRole: role },
  });

  return NextResponse.json(user, { status: 201 });
}
