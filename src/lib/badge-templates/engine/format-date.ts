// Formats de date offerts aux variables `date` d'un manifeste. `long` reproduit
// exactement l'ancien formatFrenchDate : un template migre rend sa date a
// l'identique, et la parite avec les e-mails de la plateforme est preservee.
// Source canonique, relue par le z.enum de schema.ts et le payload
// /api/schema-info de server.ts.
export const DATE_FORMATS = ["long", "court", "moisAnnee", "annee", "iso"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

// Les valeurs d'un manifeste sont des dates CALENDAIRES, pas des instants : le
// 15 decembre reste le 15 decembre quel que soit le fuseau du serveur. Tout est
// donc lu en UTC — sans quoi un badge imprime a l'ouest de l'UTC portait la veille.
const OPTIONS: Record<Exclude<DateFormat, "iso">, Intl.DateTimeFormatOptions> = {
  long: { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
  court: { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" },
  moisAnnee: { month: "long", year: "numeric", timeZone: "UTC" },
  annee: { year: "numeric", timeZone: "UTC" },
};

export function formatDate(d: Date, format: DateFormat = "long"): string {
  if (format === "iso") {
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return new Intl.DateTimeFormat("fr-FR", OPTIONS[format]).format(d);
}

// Conservee : l'application badge partage ce formatage (copie de sa
// mail-helpers.formatFrenchDate), la date d'un badge et celle d'un e-mail ne
// doivent jamais diverger.
export function formatFrenchDate(d: Date): string {
  return formatDate(d, "long");
}
