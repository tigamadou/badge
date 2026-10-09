import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export type SeedSuperAdminResult =
  | { status: "created"; email: string }
  | { status: "exists" }
  | { status: "skipped"; reason: string };

const DEFAULT_NAME = "Super Admin";

// Initialisation prod/preprod (service compose `init`) : une base est consideree
// vide tant qu'aucun SUPER_ADMIN non archive n'existe. Des qu'il y en a un, rien
// n'est touche : email et mot de passe ont pu etre changes depuis l'app.
export async function seedSuperAdmin(
  env: Record<string, string | undefined> = process.env,
): Promise<SeedSuperAdminResult> {
  const superAdmin = await prisma.user.findFirst({
    where: { isStaff: true, staffRole: "SUPER_ADMIN", archived: false },
    select: { id: true },
  });
  if (superAdmin) return { status: "exists" };

  const email = env.SEED_SUPER_ADMIN_EMAIL?.toLowerCase().trim();
  const password = env.SEED_SUPER_ADMIN_PASSWORD;
  if (!email || !password) {
    return {
      status: "skipped",
      reason: "SEED_SUPER_ADMIN_EMAIL ou SEED_SUPER_ADMIN_PASSWORD absent",
    };
  }
  if (password.length < 6) {
    throw new Error("SEED_SUPER_ADMIN_PASSWORD doit contenir au moins 6 caractères");
  }
  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (taken) {
    throw new Error(`Un compte non SUPER_ADMIN utilise déjà l'email ${email}`);
  }

  const name = env.SEED_SUPER_ADMIN_NAME?.trim() || DEFAULT_NAME;
  const user = await prisma.user.create({
    data: {
      email,
      password: await hash(password, 12),
      name,
      isStaff: true,
      staffRole: "SUPER_ADMIN",
      emailVerifiedAt: new Date(),
    },
  });
  await logActivity({
    type: "USER_CREATED",
    targetId: user.id,
    details: { email, name, staffRole: "SUPER_ADMIN", viaSeed: true },
  });
  return { status: "created", email };
}
