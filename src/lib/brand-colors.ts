// Valeurs hexa en ligne pour le HTML (e-mails, notifications, reçu) : les clients mail ne lisent
// pas les variables CSS. Miroir exact des couleurs @theme de globals.css (test de non-dérive).
export const BRAND = {
  navy: "#081558",
  navyHover: "#121F6E",
  gold: "#F4B942",
  goldStrong: "#8A5A00",
  goldSoft: "#FFF4DC",
  turquoise: "#16B8A6",
  turquoiseStrong: "#0E7C70",
  turquoiseSoft: "#E3F7F4",
  mist: "#F5F7FC",
  line: "#EEF1F8",
  navMuted: "#5A6285",
  warn: "#C2410C",
  warnSoft: "#FFF1E6",
} as const;

export type BrandColor = keyof typeof BRAND;
