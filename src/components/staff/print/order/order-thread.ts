import type { ThreadEntry } from "@/components/print/PrintThread";

// Entrée du fil côté staff : la forme de PrintThread plus l'indicateur de note interne.
export type OrderEntry = ThreadEntry & { internal: boolean };

// Chevauchement du polling : une entrée écrite pendant la lecture précédente n'est jamais perdue,
// les doublons sont écartés par identifiant.
export const POLL_OVERLAP_MS = 2000;

export function mergeEntries(current: OrderEntry[], incoming: OrderEntry[]): OrderEntry[] {
  if (incoming.length === 0) return current;
  const byId = new Map(current.map((e) => [e.id, e]));
  for (const entry of incoming) byId.set(entry.id, entry);
  return [...byId.values()].sort((a, b) =>
    a.createdAt === b.createdAt ? (a.id < b.id ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1,
  );
}

// Paramètre `after` du prochain polling : plus grand createdAt reçu moins le chevauchement.
export function afterParam(entries: OrderEntry[]): string | null {
  if (entries.length === 0) return null;
  const latest = Math.max(...entries.map((e) => Date.parse(e.createdAt)));
  return new Date(latest - POLL_OVERLAP_MS).toISOString();
}
