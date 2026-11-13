import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatEventDate } from "@/lib/format-date";
import type { LoadedDoc } from "@/lib/page-docs";
import { DocBody } from "./DocBody";

/** Lecture d'une doc en pleine page, avec retour à la liste de l'espace. */
export function DocArticle({ doc, listHref }: { doc: LoadedDoc; listHref: string }) {
  return (
    <article className="max-w-3xl">
      <Link
        href={listHref}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Documentation
      </Link>
      <h1 className="text-xl font-semibold text-navy">{doc.title}</h1>
      <p className="mb-6 mt-1 text-xs text-slate-400">Mise à jour le {formatEventDate(`${doc.updatedAt}T12:00:00`)}</p>
      <DocBody html={doc.html} />
    </article>
  );
}
