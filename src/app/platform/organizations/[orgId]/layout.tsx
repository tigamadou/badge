import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-guards";
import { AuthError } from "@/lib/auth-guards";
import { PlatformOrgShell } from "@/components/platform/PlatformOrgShell";

export default async function PlatformOrgLayout({
  params,
  children,
}: {
  params: Promise<{ orgId: string }>;
  children: React.ReactNode;
}) {
  const { orgId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(`/login?callbackUrl=/platform/organizations/${orgId}`);

  // Defensif : le parent /platform impose deja le staff, mais on garantit le niveau ici.
  try {
    await requireStaff(session.user.id, "STAFF_OBSERVER");
  } catch (e) {
    if (e instanceof AuthError) redirect("/");
    throw e;
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true },
  });
  if (!org) notFound();

  return <PlatformOrgShell org={org}>{children}</PlatformOrgShell>;
}
