import { parseQuoteMessage } from "./quote-message";

export type Tone = "client" | "staff" | "quote" | "internal" | "event";

export interface ToneEntry {
  side: "ORGANIZER" | "STAFF" | "SYSTEM";
  kind: "MESSAGE" | "EVENT";
  eventType: string | null;
  internal?: boolean;
  body?: string;
}

export const toneClasses: Record<Tone, string> = {
  client: "bg-slate-100 text-slate-800",
  staff: "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200",
  quote: "bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200",
  internal: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
  event: "bg-transparent text-slate-500",
};

// Le point de vue (`viewer`) ne change pas la teinte d'une entrée : le client est toujours neutre,
// l'équipe Badge toujours verte. Il est conservé pour que l'appelant explicite son rôle.
export function entryTone(entry: ToneEntry, _viewer: "STAFF" | "ORGANIZER"): Tone {
  if (entry.internal) return "internal";
  if (entry.kind === "EVENT") return entry.eventType === "QUOTE_SENT" ? "quote" : "event";
  if (entry.body !== undefined && parseQuoteMessage(entry.body)) return "quote";
  return entry.side === "STAFF" ? "staff" : "client";
}
