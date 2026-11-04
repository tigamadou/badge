export interface QuoteMessage {
  version: number;
  total: string;
  rows: string[];
}

// Reconnaît le récapitulatif de devis produit par `summarizeQuoteDiff` (src/lib/print-requests/quote.ts).
export function parseQuoteMessage(body: string): QuoteMessage | null {
  const lines = body.split("\n");
  const head = /^Devis v(\d+) : /.exec(lines[0] ?? "");
  const last = lines[lines.length - 1] ?? "";
  if (!head || lines.length < 3 || !last.startsWith("Total : ")) return null;
  const middle = lines.slice(1, -1);
  if (!middle.every((l) => l.startsWith("• "))) return null;
  return {
    version: Number(head[1]),
    total: last.slice("Total : ".length),
    rows: middle.map((l) => l.slice(2)),
  };
}

interface QuoteEntry {
  kind: "MESSAGE" | "EVENT";
  body: string;
  eventType: string | null;
  details: unknown;
}

// Versions annoncées par un évènement QUOTE_SENT, et lignes du récapitulatif texte de chaque version.
// Le récapitulatif d'une version annoncée n'est pas affiché à part : sa carte le remplace.
export function indexQuoteEntries(entries: QuoteEntry[]): { versions: Set<number>; rows: Map<number, string[]> } {
  const versions = new Set<number>();
  const rows = new Map<number, string[]>();
  for (const entry of entries) {
    if (entry.eventType === "QUOTE_SENT") {
      const version = (entry.details as { version?: unknown } | null)?.version;
      if (typeof version === "number") versions.add(version);
    }
    const recap = entry.kind === "MESSAGE" ? parseQuoteMessage(entry.body) : null;
    if (recap) rows.set(recap.version, recap.rows);
  }
  return { versions, rows };
}
