import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  UNREAD_POLL_INTERVAL_MS,
  createUnreadPoller,
  formatBadgeCount,
} from "../unread-poller";

function fakeDoc(state: "visible" | "hidden" = "visible") {
  const target = new EventTarget();
  const doc = {
    visibilityState: state as DocumentVisibilityState,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  };
  return {
    doc,
    setVisibility(next: "visible" | "hidden") {
      doc.visibilityState = next;
      target.dispatchEvent(new Event("visibilitychange"));
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("formatBadgeCount", () => {
  it("0 → null, 3 → « 3 », 9 → « 9 », 10 → « 9+ »", () => {
    expect(formatBadgeCount(0)).toBeNull();
    expect(formatBadgeCount(3)).toBe("3");
    expect(formatBadgeCount(9)).toBe("9");
    expect(formatBadgeCount(10)).toBe("9+");
    expect(formatBadgeCount(120)).toBe("9+");
  });
});

describe("createUnreadPoller", () => {
  it("rafraîchit au démarrage puis toutes les 30 s", async () => {
    const { doc } = fakeDoc();
    const fetchCount = vi.fn(async () => 4);
    const onCount = vi.fn();
    const poller = createUnreadPoller({ fetchCount, onCount, doc });
    expect(UNREAD_POLL_INTERVAL_MS).toBe(30_000);
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchCount).toHaveBeenCalledTimes(1);
    expect(onCount).toHaveBeenCalledWith(4);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchCount).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchCount).toHaveBeenCalledTimes(3);
    poller.stop();
  });

  it("suspend le polling onglet caché et rafraîchit aussitôt au retour", async () => {
    const { doc, setVisibility } = fakeDoc();
    const fetchCount = vi.fn(async () => 1);
    const poller = createUnreadPoller({ fetchCount, onCount: vi.fn(), doc });
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    setVisibility("hidden");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchCount).toHaveBeenCalledTimes(1);
    setVisibility("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchCount).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchCount).toHaveBeenCalledTimes(3);
    poller.stop();
  });

  it("ne démarre pas le polling si l'onglet est caché au départ", async () => {
    const { doc, setVisibility } = fakeDoc("hidden");
    const fetchCount = vi.fn(async () => 1);
    const poller = createUnreadPoller({ fetchCount, onCount: vi.fn(), doc });
    poller.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchCount).not.toHaveBeenCalled();
    setVisibility("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchCount).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it("s'arrête définitivement quand fetchCount renvoie null", async () => {
    const { doc, setVisibility } = fakeDoc();
    const fetchCount = vi.fn(async () => null);
    const onCount = vi.fn();
    const poller = createUnreadPoller({ fetchCount, onCount, doc });
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchCount).toHaveBeenCalledTimes(1);
    setVisibility("hidden");
    setVisibility("visible");
    await poller.refresh();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchCount).toHaveBeenCalledTimes(1);
    expect(onCount).not.toHaveBeenCalled();
    poller.stop();
  });

  it("ignore une erreur réseau", async () => {
    const { doc } = fakeDoc();
    const fetchCount = vi.fn().mockRejectedValueOnce(new Error("réseau")).mockResolvedValue(2);
    const onCount = vi.fn();
    const poller = createUnreadPoller({ fetchCount, onCount, doc });
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(onCount).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(onCount).toHaveBeenCalledWith(2);
    poller.stop();
  });

  it("stop retire l'écouteur et arrête les minuteurs", async () => {
    const { doc, setVisibility } = fakeDoc();
    const fetchCount = vi.fn(async () => 1);
    const poller = createUnreadPoller({ fetchCount, onCount: vi.fn(), doc, intervalMs: 1000 });
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    poller.stop();
    setVisibility("hidden");
    setVisibility("visible");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchCount).toHaveBeenCalledTimes(1);
  });
});
