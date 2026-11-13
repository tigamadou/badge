import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePlatformPage } from "@/app/platform/page-guard";
import { PlatformOrgShell } from "@/components/platform/PlatformOrgShell";

export default async function PlatformOrgLayout({
  params,
  children,
}: {
  params: Promise<{ orgId: string }>;
  children: React.ReactNode;
}) {
  const { orgId } = await params;
  const { permissions } = await requirePlatformPage("organizations.read", `/platform/organizations/${orgId}`);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true },
  });
  if (!org) notFound();

  return <PlatformOrgShell org={org} canReadActivity={permissions.has("activity.read")}>{children}</PlatformOrgShell>;
}
