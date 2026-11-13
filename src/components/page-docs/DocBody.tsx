// Enveloppe de style d'un corps de doc déjà rendu (Markdown -> HTML sans HTML brut, voir src/lib/page-docs/render.ts).
export function DocBody({ html }: { html: string }) {
  return (
    <div
      className={[
        "text-sm leading-relaxed text-slate-600",
        "[&_h1]:mb-3 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-navy",
        "[&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-navy",
        "[&_h3]:mb-1.5 [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-navy",
        "[&_p]:my-2 [&_strong]:font-semibold [&_strong]:text-slate-900",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1",
        "[&_a]:font-medium [&_a]:text-navy [&_a]:underline",
        "[&_code]:rounded [&_code]:bg-mist [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px]",
        "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3",
        "[&_table]:my-3 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:text-left [&_table]:text-[13px]",
        "[&_th]:border-b [&_th]:border-line [&_th]:px-2 [&_th]:py-1.5 [&_th]:font-semibold [&_th]:text-slate-900",
        "[&_td]:border-b [&_td]:border-slate-100 [&_td]:px-2 [&_td]:py-1.5",
        "[&_em]:text-slate-500",
        "break-words",
      ].join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
