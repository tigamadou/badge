// Classes de boutons reutilisables du site public (Tailwind). Centralisees pour
// eviter la duplication entre landing, pages marketing et CTA.
export const btnPrimaryLg =
  "inline-flex items-center gap-2 rounded-[10px] bg-green-600 px-5 py-3 text-[15px] font-medium text-white transition-colors hover:bg-green-700";
export const btnSecondaryLg =
  "inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-5 py-3 text-[15px] font-medium text-slate-700 transition-colors hover:bg-slate-50";
export const btnOnNavy =
  "inline-flex items-center gap-2 rounded-[10px] bg-white px-5 py-3 text-[15px] font-medium text-brand-navy transition-colors hover:bg-white/90";
export const btnGhostNavy =
  "inline-flex items-center gap-2 rounded-[10px] border border-white/25 bg-white/10 px-5 py-3 text-[15px] font-medium text-white transition-colors hover:bg-white/20";

// Police display (Montserrat) pour les gros titres. Utilisee en style inline.
export const displayFont = { fontFamily: "var(--font-badge)" } as const;
