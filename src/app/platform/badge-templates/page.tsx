import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/ui/Icon";
import { BadgeTemplateInstaller } from "@/components/staff/BadgeTemplateInstaller";
import { BadgeTemplateArchiveButton } from "@/components/staff/BadgeTemplateArchiveButton";

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);
}

export default async function PlatformBadgeTemplatesPage() {
  const session = await getServerSession(authOptions);
  const me = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id as string },
        select: { staffRole: true },
      })
    : null;
  // L'installation modifie le catalogue : reservee a STAFF_ADMIN et au-dessus,
  // comme les autres reglages plateforme. Les autres roles consultent.
  const canInstall = me?.staffRole === "STAFF_ADMIN" || me?.staffRole === "SUPER_ADMIN";

  const templates = await prisma.installedBadgeTemplate.findMany({
    orderBy: [{ family: "asc" }, { version: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Templates de badge</h1>
        <p className="mt-1 text-sm text-slate-600">
          Installez un modèle de badge sous forme d&apos;archive. Chaque installation crée une
          version figée : les événements qui utilisent une version antérieure ne sont pas affectés.
        </p>
      </div>

      {canInstall && <BadgeTemplateInstaller />}

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Catalogue</h2>
        </div>

        {templates.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-600">
            Aucun template installé. Les badges utilisent les modèles livrés avec
            l&apos;application.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {templates.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-[220px] flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    {t.label}{" "}
                    <span className="text-xs font-normal text-slate-500">
                      ({t.family} · v{t.version})
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {t.pages} page{t.pages > 1 ? "s" : ""} · {t.pageWidthMm}×{t.pageHeightMm} mm ·
                    installé le {formatDate(t.createdAt)}
                  </p>
                </div>

                {t.archived ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                    <Icon name="archive" size={13} /> Archivé
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
                    <Icon name="check" size={13} /> Disponible
                  </span>
                )}

                {canInstall && <BadgeTemplateArchiveButton id={t.id} archived={t.archived} />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
