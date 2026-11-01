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
}): Promise<PollOutcome> {
  const maxFailures = opts.maxFailures ?? MAX_POLL_FAILURES;
  let failures = 0;
  for (;;) {
    await opts.sleep(opts.intervalMs);
    if (opts.cancelled()) return { kind: "cancelled" };
    try {
      const res = await opts.fetchStatus();
      if (opts.cancelled()) return { kind: "cancelled" };
      if (res.ok) {
        failures = 0;
        const { export: exp } = (await res.json()) as { export: { status: string; fileKey: string | null } };
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
