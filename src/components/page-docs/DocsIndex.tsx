import Link from "next/link";
import { EmptyState } from "@/components/ui/Feedback";
import { Card } from "@/components/ui/Card";
import type { DocListItem } from "@/lib/page-docs";

const INTRO: Record<string, string> = {
  platform: "Une aide par écran de l'espace plateforme : à quoi il sert et ce que fait chaque option.",
  org: "Une aide par écran de votre organisation : à quoi il sert et ce que fait chaque option.",
  event: "Une aide par écran de votre évènement : à quoi il sert et ce que fait chaque option.",
  account: "Une aide par écran de votre compte : à quoi il sert et ce que fait chaque option.",
};

function sectionLabel(section: string): string {
  const text = section.replace(/-/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function groupBySection(items: DocListItem[]): { section: string; items: DocListItem[] }[] {
  const groups = new Map<string, DocListItem[]>();
  for (const item of items) groups.set(item.section, [...(groups.get(item.section) ?? []), item]);
  return [...groups].map(([section, list]) => ({ section, items: list }));
}

/** Liste des docs d'un espace, groupées par section ; `baseHref` est la page `…/docs` de l'espace. */
export function DocsIndex({ space, baseHref, items }: { space: string; baseHref: string; items: DocListItem[] }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-navy">Documentation</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">{INTRO[space]}</p>
      {items.length === 0 ? (
        <Card>
          <EmptyState icon="file" title="Aucune documentation disponible pour votre profil" />
        </Card>
      ) : (
        <div className="space-y-6">
          {groupBySection(items).map((group) => (
            <section key={group.section} aria-labelledby={`doc-section-${group.section}`}>
              <h2 id={`doc-section-${group.section}`} className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                {sectionLabel(group.section)}
              </h2>
              <ul className="grid gap-2 md:grid-cols-2">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`${baseHref}/${item.slug}`}
                      className="block h-full rounded-xl border border-slate-200 bg-white px-4 py-3 hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
                    >
                      <span className="block text-sm font-medium text-navy">{item.title}</span>
                      {item.summary ? <span className="mt-0.5 block text-[13px] text-slate-500">{item.summary}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
