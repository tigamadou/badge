import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/** Identifiant de l'utilisateur connecté pour les pages Documentation (les gabarits d'espace ont déjà gardé l'accès). */
export async function requireDocsUserId(path: string): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(path)}`);
  return session.user.id;
}
