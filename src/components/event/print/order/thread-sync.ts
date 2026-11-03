import type { ThreadEntryDTO } from "@/lib/print-requests/thread";
import { describeLineChange, type LineChange } from "@/lib/print-requests/line-change";

export const POLL_MS = 10_000;
// Chevauchement des relevés : une entrée créée pendant une requête précédente n'est pas perdue.
export const OVERLAP_MS = 2_000;

// Fusionne par identifiant (un même message peut revenir dans le chevauchement), en ordre chronologique.
export function mergeEntries(current: ThreadEntryDTO[], incoming: ThreadEntryDTO[]): ThreadEntryDTO[] {
  const byId = new Map(current.map((e) => [e.id, e]));
  for (const entry of incoming) byId.set(entry.id, entry);
  return [...byId.values()].sort((a, b) =>
    a.createdAt === b.createdAt ? (a.id < b.id ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1,
  );
}

// Borne `after` du prochain relevé : plus grand createdAt reçu moins le chevauchement.
export function afterCursor(entries: ThreadEntryDTO[]): string | null {
  if (entries.length === 0) return null;
  const latest = Math.max(...entries.map((e) => new Date(e.createdAt).getTime()));
  return new Date(latest - OVERLAP_MS).toISOString();
}

export function entriesUrlAfter(base: string, entries: ThreadEntryDTO[]): string {
  const after = afterCursor(entries);
  return after ? `${base}?after=${encodeURIComponent(after)}` : base;
}

// Modifications de lignes regroupées d'une entrée LINES_CHANGED.
export function lineChangesOf(entry: Pick<ThreadEntryDTO, "eventType" | "details">): string[] {
  if (entry.eventType !== "LINES_CHANGED") return [];
  const changes = (entry.details as { changes?: unknown } | null)?.changes;
  return Array.isArray(changes) ? (changes as LineChange[]).map(describeLineChange) : [];
}

export const attachmentName = (key: string): string => key.split("/").pop() ?? key;
