import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import { loadUserContext } from "@/lib/user-context";
import { listAvailableTemplates } from "@/lib/badge-templates/resolve";
import BadgeTemplatePicker, {
  type TemplateSummary,
} from "@/components/admin/BadgeTemplatePicker";

export const dynamic = "force-dynamic";

export default async function StaffBadgeSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/platform/settings/badge");
  }
  const ctx = await loadUserContext(session.user.id);
  if (!ctx || !ctx.staffRole || !staffRoleAtLeast(ctx.staffRole, "STAFF_ADMIN")) {
    redirect("/platform");
  }

  const platform = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
    select: { badgeTemplateId: true },
  });

  const currentValue = platform?.badgeTemplateId ?? "default-v1";

  const templates: TemplateSummary[] = await listAvailableTemplates();

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Template de badge par defaut</h1>
        <p className="text-sm text-slate-600 mt-1">
          Template utilise par defaut pour toute la plateforme. Les organisations et
          evenements peuvent surcharger ce choix. <strong>Pas d&apos;option heriter</strong> :
          ce niveau est la racine de la cascade.
        </p>
      </div>

      <BadgeTemplatePicker
        templates={templates}
        currentValue={currentValue}
        effectiveId={currentValue}
        effectiveLevel="platform"
        patchUrl="/api/platform/settings/badge"
        canClearToInherit={false}
      />
    </div>
  );
}
