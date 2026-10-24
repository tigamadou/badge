export const UNREAD_POLL_INTERVAL_MS = 30_000;

// 0 → null (pastille masquée), 1..9 → "1".."9", au-delà → "9+".
export function formatBadgeCount(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? "9+" : String(count);
}

// Contrôleur de polling du compteur : suspendu onglet caché, rafraîchi aussitôt au retour,
// arrêté définitivement sur 401 (fetchCount renvoie null).
export function createUnreadPoller(deps: {
  fetchCount: () => Promise<number | null>;
  onCount: (n: number) => void;
  doc: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  intervalMs?: number;
}) {
  const { fetchCount, onCount, doc } = deps;
  const intervalMs = deps.intervalMs ?? UNREAD_POLL_INTERVAL_MS;
  let timer: ReturnType<typeof setInterval> | null = null;
  let dead = false;

  async function refresh(): Promise<void> {
    if (dead) return;
    try {
      const count = await fetchCount();
      if (count === null) {
        dead = true;
        stopTimer();
        return;
      }
      onCount(count);
    } catch {
      // Erreur réseau : le compteur garde sa dernière valeur.
    }
  }

  function startTimer() {
    if (timer === null && !dead) timer = setInterval(() => void refresh(), intervalMs);
  }

  function stopTimer() {
    if (timer !== null) clearInterval(timer);
    timer = null;
  }

  function onVisibilityChange() {
    if (doc.visibilityState === "hidden") {
      stopTimer();
      return;
    }
    void refresh();
    startTimer();
  }

  return {
    start() {
      doc.addEventListener("visibilitychange", onVisibilityChange);
      if (doc.visibilityState !== "hidden") {
        void refresh();
        startTimer();
      }
    },
    stop() {
      stopTimer();
      doc.removeEventListener("visibilitychange", onVisibilityChange);
    },
    refresh,
  };
}
