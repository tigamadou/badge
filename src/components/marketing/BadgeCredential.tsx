import { Icon } from "@/components/ui/Icon";
import { displayFont } from "@/components/marketing/styles";

const qrStyle: React.CSSProperties = {
  background:
    "conic-gradient(from 0deg, #0f172a 0 25%, transparent 0 50%) 0 0/8px 8px, conic-gradient(from 0deg, #0f172a 0 25%, transparent 0 50%) 4px 4px/8px 8px",
  backgroundColor: "#fff",
  border: "3px solid #0f172a",
  borderRadius: 4,
};

// Maquette de credential (badge) — reproduit .badge-card du design. Contenu par
// defaut : l'exemple "Camille Fabre / Salon Pro 2026" du site public.
export function BadgeCredential({
  name = "Camille Fabre",
  role = "Chef de projet · Studio Nord",
  orgLabel = "Salon Pro 2026",
  orgInitials = "SP",
  category = "Visiteur",
  categoryColor = "#0ea5e9",
  meta = ["Paris Expo · Hall 4", "14–16 mars 2026", "#BDG-10248"],
}: {
  name?: string;
  role?: string;
  orgLabel?: string;
  orgInitials?: string;
  category?: string;
  categoryColor?: string;
  meta?: string[];
}) {
  return (
    <div
      style={displayFont}
      className="flex h-[360px] w-[257px] flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-white"
    >
      <div className="h-3 bg-brand-navy" />
      <div className="flex items-center gap-2.5 px-5 pt-[18px]">
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-brand-navy">
          {orgInitials}
        </span>
        <span className="text-xs font-semibold tracking-[0.02em] text-slate-600">{orgLabel}</span>
      </div>
      <div className="mx-auto mb-3.5 mt-4 flex h-[120px] w-[120px] items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <Icon name="user" size={44} />
      </div>
      <div className="px-4 text-center text-[22px] font-bold leading-[1.15] text-slate-900">{name}</div>
      <div className="mt-1 text-center text-[13px] font-medium text-slate-600">{role}</div>
      <div
        className="mx-5 mt-3.5 rounded-lg px-3 py-[7px] text-center text-[13px] font-bold uppercase tracking-[0.04em] text-white"
        style={{ background: categoryColor }}
      >
        {category}
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 px-5 py-4">
        <div className="h-16 w-16 flex-none" style={qrStyle} />
        <div className="text-[10px] leading-[1.4] text-slate-400">
          {meta.map((m) => (
            <div key={m}>{m}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
