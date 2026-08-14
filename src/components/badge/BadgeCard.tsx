import type { ReactNode } from "react";

// Carte credential a l'ecran (~100x140mm a l'echelle) reproduisant `.badge-card`
// du template. Distincte des composants @react-pdf (`BadgeDocument*`) qui generent
// le PDF. Reconciliation des doublons `BadgePreview*`/`BadgeWebPreview*` : a arbitrer
// avec l'utilisateur (suppression = accord explicite) lors des tasks de sous-plan.
export function BadgeCard({
  org,
  name,
  role,
  category,
  categoryColor,
  qr,
  meta,
  allAccess,
}: {
  org: ReactNode;
  name: ReactNode;
  role?: ReactNode;
  category: ReactNode;
  categoryColor: string;
  qr: ReactNode;
  meta: ReactNode;
  allAccess?: boolean;
}) {
  return (
    <div className="relative flex h-[360px] w-[257px] flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-white font-badge">
      <div className="h-3 bg-brand-navy" />
      <div className="px-5 pt-4 text-xs font-semibold tracking-wide text-slate-600">{org}</div>
      <div className="mx-auto my-4 flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400" />
      <div className="px-4 text-center text-[22px] font-bold leading-tight text-slate-900">{name}</div>
      {role ? <div className="mt-1 text-center text-[13px] font-medium text-slate-600">{role}</div> : null}
      <div
        className="mx-5 mt-3.5 rounded-lg px-3 py-1.5 text-center text-[13px] font-bold uppercase tracking-wider text-white"
        style={{ background: categoryColor }}
      >
        {category}
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 px-5 py-4">
        <div className="h-16 w-16 flex-none">{qr}</div>
        <div className="text-[10px] leading-tight text-slate-400">{meta}</div>
      </div>
      {allAccess ? (
        <div className="absolute right-[-34px] top-[30px] rotate-45 bg-rose-600 px-10 py-1 text-[10px] font-bold tracking-widest text-white">
          ALL ACCESS
        </div>
      ) : null}
    </div>
  );
}
