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
  staff: "bg-turquoise-soft text-navy ring-1 ring-turquoise-strong/20",
  quote: "bg-mist text-navy ring-1 ring-line",
  internal: "bg-gold-soft text-gold-strong ring-1 ring-gold",
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
