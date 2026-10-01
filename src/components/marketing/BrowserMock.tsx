// Cadre "navigateur" pour les maquettes produit (hero, splits). Barre superieure
// avec 3 pastilles + URL factice, puis le contenu.
export function BrowserMock({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)]">
      <div className="flex items-center gap-[7px] border-b border-slate-100 bg-slate-50 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="ml-2.5 text-xs text-slate-400">{url}</span>
      </div>
      <div className="p-[18px]">{children}</div>
    </div>
  );
}
