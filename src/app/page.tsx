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
  // Note : `lastOrgId` est persiste cote client en localStorage et n'est pas lisible
  // cote serveur. La logique sans hint est appliquee ici ; `OrgSelector` cote client
  // gere la navigation entre orgs apres connexion.
  const target = resolveHomeRedirect(ctx, null);
  redirect(target);
}
