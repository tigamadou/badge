import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasOrgRole } from "@/lib/auth-helpers";
import { loadUserContext } from "@/lib/user-context";
import { listTemplates } from "@/lib/badge-templates";
import { resolveBadgeTemplateId } from "@/lib/settings";
import BadgeTemplatePicker, {
  type EffectiveLevel,
  type TemplateSummary,
} from "@/components/admin/BadgeTemplatePicker";

export const dynamic = "force-dynamic";

export default async function OrgBadgeSettingsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/admin/${orgId}/settings/badge`);
  }
  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");
  if (!hasOrgRole(ctx, orgId, "MANAGER")) {
    redirect(`/admin/${orgId}`);
  }

  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, badgeTemplateId: true },
  });
  if (!organization) notFound();

  const platform = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
    select: { badgeTemplateId: true },
  });

  const effectiveId = resolveBadgeTemplateId(
    null,
    { badgeTemplateId: organization.badgeTemplateId },
    platform ?? { badgeTemplateId: "default-v1" },
  );
  const effectiveLevel: EffectiveLevel = organization.badgeTemplateId
    ? "org"
    : "platform";

  const templates: TemplateSummary[] = listTemplates().map((t) => ({
    id: t.meta.id,
    label: t.meta.label,
    description: t.meta.description,
    pages: t.meta.pages,
    pageSize: t.meta.pageSize,
    previewSrc: t.meta.previewSrc,
  }));

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Template de badge</h1>
        <p className="text-sm text-gray-600 mt-1">
          Choisissez le template par defaut pour tous les evenements de{" "}
          {organization.name}. Chaque evenement peut surcharger ce choix.
        </p>
      </div>

      <BadgeTemplatePicker
        templates={templates}
        currentValue={organization.badgeTemplateId}
        effectiveId={effectiveId}
        effectiveLevel={effectiveLevel}
        patchUrl={`/api/admin/${orgId}/settings/badge`}
        canClearToInherit
      />
    </div>
  );
}
