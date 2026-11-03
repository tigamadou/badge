// Logique cliente du panneau de lot, sans React ni DOM (testable sous Vitest node).
import { chunk, MARK_PRINTED_CHUNK } from "@/lib/badge-batch";

export type MarkResult = {
  // Identifiants des paquets acceptes avant l'eventuel echec.
  markedIds: string[];
  // Somme des `printed` renvoyes par la route.
  printed: number;
  // Reponse ou erreur du premier paquet en echec ; absent si tout est passe.
  failure?: unknown;
};

// Envoie les identifiants par paquets de 500, dans l'ordre, et s'arrete au premier echec.
// `onChunk` est appele apres chaque paquet reussi pour mettre l'ecran a jour au fil de l'eau.
export async function markInChunks(
  ids: string[],
  send: (part: string[]) => Promise<Response>,
  onChunk?: (partIds: string[]) => void,
  size: number = MARK_PRINTED_CHUNK,
): Promise<MarkResult> {
  const result: MarkResult = { markedIds: [], printed: 0 };
  for (const part of chunk(ids, size)) {
    try {
      const res = await send(part);
      if (!res.ok) {
        result.failure = res;
        return result;
      }
      result.printed += ((await res.json()) as { printed: number }).printed;
    } catch (err) {
      result.failure = err;
      return result;
    }
    result.markedIds.push(...part);
    onChunk?.(part);
  }
  return result;
}

export const MAX_POLL_FAILURES = 10;

// Au-dela de cette attente en PENDING, le panneau previent que le traitement peut etre retarde.
export const PENDING_HINT_MS = 5 * 60_000;

// Stockage cle/valeur minimal (sessionStorage ou doublure de test).
export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export const SELECTION_KEY_PREFIX = "badge-batch-sel:";
const EXPORT_KEY_PREFIX = "badge-batch-export:";

function randomKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Range la selection (liste d'ids, potentiellement des milliers) sous une cle aleatoire et
// renvoie cette cle, a passer dans l'URL (`?sel=`) a la place des ids. Les anciennes selections
// sont purgees. null si le stockage est indisponible ou plein.
export function storeSelection(store: KeyValueStore, ids: string[]): string | null {
  try {
    const stale: string[] = [];
    try {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k?.startsWith(SELECTION_KEY_PREFIX)) stale.push(k);
      }
    } catch {
      // Lecture des cles impossible : on garde les anciennes, sans bloquer.
    }
    stale.forEach((k) => store.removeItem(k));
    const key = randomKey();
    store.setItem(`${SELECTION_KEY_PREFIX}${key}`, JSON.stringify(ids));
    return key;
  } catch {
    return null;
  }
}

// Relit la selection ; null si absente, illisible, mal formee ou vide.
export function readSelection(store: KeyValueStore, key: string | null): string[] | null {
  if (!key) return null;
  try {
    const parsed: unknown = JSON.parse(store.getItem(`${SELECTION_KEY_PREFIX}${key}`) ?? "null");
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    if (!parsed.every((v) => typeof v === "string" && v.length > 0)) return null;
    return parsed as string[];
  } catch {
    return null;
  }
}

// Export ZIP en cours, retenu par evenement + selection pour reprendre le suivi apres un rechargement.
export function exportStorageKey(eventId: string, selectionKey: string): string {
  return `${EXPORT_KEY_PREFIX}${eventId}:${selectionKey}`;
}

export function rememberExport(store: KeyValueStore, eventId: string, selectionKey: string, exportId: string): void {
  try {
    store.setItem(exportStorageKey(eventId, selectionKey), exportId);
  } catch {
    // Stockage indisponible : le suivi fonctionne, seule la reprise est perdue.
  }
}

export function recallExport(store: KeyValueStore, eventId: string, selectionKey: string): string | null {
  try {
    return store.getItem(exportStorageKey(eventId, selectionKey));
  } catch {
    return null;
  }
}

export function forgetExport(store: KeyValueStore, eventId: string, selectionKey: string): void {
  try {
    store.removeItem(exportStorageKey(eventId, selectionKey));
  } catch {
    // ignore
  }
}

export type PollOutcome =
  | { kind: "done"; fileKey: string }
  | { kind: "failed"; message: string }
  | { kind: "cancelled" };

// Interroge l'export jusqu'a sa fin. Les requetes sont sequentielles (jamais deux en vol).
// 401/403/404 : arret immediat. 5xx ou reseau : on continue, jusqu'a `maxFailures` echecs de suite.
export async function pollExport(opts: {
  fetchStatus: () => Promise<Response>;
  sleep: (ms: number) => Promise<void>;
  cancelled: () => boolean;
  intervalMs: number;
  maxFailures?: number;
  // Horloge et seuil de l'attente en PENDING ; `onPendingLong(true)` une fois le seuil depasse,
  // `onPendingLong(false)` quand l'export quitte PENDING apres avoir ete signale.
  now?: () => number;
  pendingHintMs?: number;
  onPendingLong?: (long: boolean) => void;
}): Promise<PollOutcome> {
  const maxFailures = opts.maxFailures ?? MAX_POLL_FAILURES;
  const now = opts.now ?? Date.now;
  const hintMs = opts.pendingHintMs ?? PENDING_HINT_MS;
  let failures = 0;
  let pendingSince: number | null = null;
  let hinted = false;
  for (;;) {
    await opts.sleep(opts.intervalMs);
    if (opts.cancelled()) return { kind: "cancelled" };
    try {
      const res = await opts.fetchStatus();
      if (opts.cancelled()) return { kind: "cancelled" };
      if (res.ok) {
        failures = 0;
        const { export: exp } = (await res.json()) as { export: { status: string; fileKey: string | null } };
        if (exp.status === "PENDING") {
          pendingSince ??= now();
          if (!hinted && now() - pendingSince > hintMs) {
            hinted = true;
            opts.onPendingLong?.(true);
          }
        } else {
          pendingSince = null;
          if (hinted) {
            hinted = false;
            opts.onPendingLong?.(false);
          }
        }
        if (exp.status === "DONE" && exp.fileKey) return { kind: "done", fileKey: exp.fileKey };
        if (exp.status === "FAILED") {
          return { kind: "failed", message: "La préparation du ZIP a échoué. Réessayez." };
        }
        continue;
      }
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        return { kind: "failed", message: "Le suivi de l'export est inaccessible. Réessayez la préparation." };
      }
    } catch {
      // Réseau instable : compté comme un échec transitoire.
    }
    failures += 1;
    if (failures >= maxFailures) {
      return { kind: "failed", message: "Le suivi de l'export est interrompu (serveur injoignable). Réessayez." };
    }
  }
}
