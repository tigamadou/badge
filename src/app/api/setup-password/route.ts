import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

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

  return NextResponse.json({ message: "Mot de passe configuré avec succès" });
}
