const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export function formatEventDate(date: string | Date): string {
  const d = new Date(date);
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} . ${year}`;
}

// Jour ISO (YYYY-MM-DD) pour les inputs date. Module partage (non-client) afin d'etre
// appelable depuis les Server Components comme depuis les composants client.
export function isoDay(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}
