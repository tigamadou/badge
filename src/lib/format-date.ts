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

// v4 (plan 07) : libelle de periode. `endDate` est optionnelle et informative ;
// une fin le meme jour est traitee comme une absence de fin.
export function formatEventPeriod(
  date: string | Date,
  endDate: string | Date | null,
): string {
  const start = formatEventDate(date);
  if (!endDate) return start;
  const end = formatEventDate(endDate);
  if (end === start) return start;
  return `Du ${start} au ${end}`;
}

// Jour ISO (YYYY-MM-DD) pour les inputs date. Module partage (non-client) afin d'etre
// appelable depuis les Server Components comme depuis les composants client.
export function isoDay(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}
