import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { resolveHomeRedirect } from "@/lib/org-redirect";
import { LandingView } from "@/components/public/LandingView";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <LandingView />;

  const ctx = await loadUserContext(session.user.id);
  // v4 Bloc D : redirection vers l'unique workspace accessible, ou vers le
  // selecteur `/select` si l'utilisateur en a plusieurs.
  const target = resolveHomeRedirect(ctx);
  redirect(target);
}
