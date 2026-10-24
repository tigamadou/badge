const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto", style: "short" });

const UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: "year", seconds: 365 * 24 * 3600 },
  { unit: "month", seconds: 30 * 24 * 3600 },
  { unit: "day", seconds: 24 * 3600 },
  { unit: "hour", seconds: 3600 },
  { unit: "minute", seconds: 60 },
];

// « il y a 5 min », « hier », « il y a 3 j »… Sous une minute (ou date future) : « maintenant ».
export function formatRelativeTime(date: Date | string, now: Date = new Date()): string {
  const elapsed = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
  const match = UNITS.find((u) => elapsed >= u.seconds);
  const text = match
    ? rtf.format(-Math.floor(elapsed / match.seconds), match.unit)
    : rtf.format(0, "second");
  // Intl insère des espaces insécables : on normalise (affichage et tests plus simples).
  return text.replace(/[\u00a0\u202f]/g, " ");
}
