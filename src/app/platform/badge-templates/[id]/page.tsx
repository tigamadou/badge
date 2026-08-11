import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listPrefix } from "@/lib/storage";
import { previewUrl } from "@/lib/badge-templates/resolve";
import { Icon } from "@/components/ui/Icon";
import { TemplatePreview } from "@/components/ui/TemplatePreview";
import { ManifestDownloadButton } from "@/components/staff/ManifestDownloadButton";

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);
}

function formatSize(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} ko`;
}

export default async function BadgeTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await prisma.installedBadgeTemplate.findUnique({ where: { id } });
  if (!template) notFound();

  const [events, orgs, platformCount, versions, objets] = await Promise.all([
    prisma.event.findMany({
      where: { badgeTemplateId: id },
      select: { id: true, title: true, orgId: true },
      orderBy: { title: "asc" },
    }),
    prisma.organization.findMany({
      where: { badgeTemplateId: id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.platformSettings.count({ where: { badgeTemplateId: id } }),
    prisma.installedBadgeTemplate.findMany({
      where: { family: template.family },
      orderBy: { version: "desc" },
      select: { id: true, version: true, archived: true, createdAt: true },
    }),
    listPrefix(template.assetPrefix),
  ]);

  const apercu = previewUrl(template.previewPath);
  const manifeste = JSON.stringify(template.layout, null, 2);
  const totalUsages = events.length + orgs.length + platformCount;
  // L'apercu vit sous le meme prefixe que les ressources : ce n'est pas une ressource
  // du paquet, on ne le compte pas comme telle.
  const ressources = objets.filter((o) => !o.key.endsWith("/preview.pdf"));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/platform/badge-templates"
          className="inline-flex items-center gap-1 text-sm text-green-600 hover:underline"
        >
          <Icon name="arrow-left" size={14} /> Templates de badge
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{template.label}</h1>
          {template.archived ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
              <Icon name="archive" size={13} /> Archivé
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
              <Icon name="check" size={13} /> Disponible
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {template.family} · version {template.version} · {template.pages} page
          {template.pages > 1 ? "s" : ""} · {template.pageWidthMm}×{template.pageHeightMm} mm ·
          installé le {formatDate(template.createdAt)}
        </p>
        {template.description && (
          <p className="mt-2 text-sm text-slate-700">{template.description}</p>
        )}
      </div>

      {/* Deux colonnes a partir de lg : l'apercu occupe la colonne principale, les
          informations la colonne laterale. En dessous de lg, tout s'empile. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Aperçu</h2>
            {apercu && (
              <a
                href={apercu}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-green-600 hover:underline"
              >
                <Icon name="external-link" size={14} /> Ouvrir en plein écran
              </a>
            )}
          </div>
          <div className="mt-3 flex h-[520px] items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
            <TemplatePreview src={apercu} label={template.label} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Utilisé par</h2>
            {totalUsages === 0 ? (
              <p className="mt-2 text-sm text-slate-600">
                Aucun évènement ni organisation n&apos;utilise cette version. Elle peut être
                archivée sans conséquence.
              </p>
            ) : (
              <div className="mt-3 space-y-3 text-sm">
                {platformCount > 0 && (
                  <p className="text-slate-700">
                    <strong>Défaut de la plateforme</strong> — ce template est la racine de la
                    cascade.
                  </p>
                )}
                {orgs.length > 0 && (
                  <div>
                    <p className="font-medium text-slate-900">
                      {orgs.length} organisation{orgs.length > 1 ? "s" : ""}
                    </p>
                    <ul className="mt-1 space-y-1">
                      {orgs.map((o) => (
                        <li key={o.id}>
                          <Link
                            href={`/platform/organizations/${o.id}`}
                            className="text-green-700 hover:underline"
                          >
                            {o.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {events.length > 0 && (
                  <div>
                    <p className="font-medium text-slate-900">
                      {events.length} évènement{events.length > 1 ? "s" : ""}
                    </p>
                    <ul className="mt-1 space-y-1">
                      {events.map((e) => (
                        <li key={e.id} className="text-slate-700">
                          {e.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Versions de la famille « {template.family} »
            </h2>
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {versions.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="min-w-[80px] font-medium text-slate-900">v{v.version}</span>
                  <span className="text-slate-500">{formatDate(v.createdAt)}</span>
                  {v.archived && <span className="text-xs text-slate-500">archivée</span>}
                  {v.id === template.id ? (
                    <span className="text-xs text-emerald-700">version affichée</span>
                  ) : (
                    <Link
                      href={`/platform/badge-templates/${v.id}`}
                      className="text-green-700 hover:underline"
                    >
                      Voir
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {ressources.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Ressources embarquées</h2>
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {ressources.map((o) => (
                  <li key={o.key} className="flex items-center justify-between py-2">
                    <span className="font-mono text-[13px] text-slate-700">
                      {o.key.replace(template.assetPrefix, "")}
                    </span>
                    <span className="text-slate-500">{formatSize(o.size)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Pleine largeur : du JSON indente a besoin de place pour rester lisible. */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Manifeste</h2>
          <ManifestDownloadButton
            json={manifeste}
            filename={`${template.family}-v${template.version}.json`}
          />
        </div>
        <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-700">
          {manifeste}
        </pre>
      </div>
    </div>
  );
}
