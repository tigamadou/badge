import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { logActivity } from "@/lib/activity-log";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || !password) {
    return NextResponse.json({ error: "Token et mot de passe requis" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { inviteToken: token } });
  if (!user || !user.inviteTokenExpiry || user.inviteTokenExpiry < new Date()) {
    return NextResponse.json({ error: "Token invalide ou expiré" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await hash(password, 12),
      inviteToken: null,
      inviteTokenExpiry: null,
    },
  });

  await logActivity({
    type: "USER_PASSWORD_SET",
    userId: user.id,
    targetId: user.id,
    details: { userName: user.name, userEmail: user.email },
  });

  return NextResponse.json({ message: "Mot de passe configure avec succes" });
}
