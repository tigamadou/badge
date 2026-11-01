import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startVisibleInterval } from "@/hooks/useVisibleInterval";

// Faux document : visibilityState modifiable et écouteurs déclenchables à la main.
function fakeDoc(initial: "visible" | "hidden") {
  const listeners = new Set<() => void>();
  const doc = {
    visibilityState: initial,
    addEventListener: (_t: "visibilitychange", l: () => void) => void listeners.add(l),
    removeEventListener: (_t: "visibilitychange", l: () => void) => void listeners.delete(l),
  };
  return {
    doc,
    listeners,
    setState(state: "visible" | "hidden") {
      doc.visibilityState = state;
      listeners.forEach((l) => l());
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("startVisibleInterval", () => {
  it("appelle le callback 3 fois en 90 s quand la page est visible", () => {
    const { doc } = fakeDoc("visible");
    const cb = vi.fn();
    startVisibleInterval(cb, 30_000, doc);
    vi.advanceTimersByTime(90_000);
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it("n'appelle jamais le callback quand la page est cachée", () => {
    const { doc } = fakeDoc("hidden");
    const cb = vi.fn();
    startVisibleInterval(cb, 30_000, doc);
    vi.advanceTimersByTime(90_000);
    expect(cb).not.toHaveBeenCalled();
  });

  it("appelle une fois au retour de visibilité puis reprend le rythme", () => {
    const { doc, setState } = fakeDoc("hidden");
    const cb = vi.fn();
    startVisibleInterval(cb, 30_000, doc);
    vi.advanceTimersByTime(60_000);
    setState("visible");
    expect(cb).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30_000);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("ne rappelle pas au passage en caché et suspend le rythme", () => {
    const { doc, setState } = fakeDoc("visible");
    const cb = vi.fn();
    startVisibleInterval(cb, 30_000, doc);
    vi.advanceTimersByTime(30_000);
    setState("hidden");
    vi.advanceTimersByTime(120_000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("l'arrêt retire l'écouteur et le minuteur", () => {
    const { doc, listeners, setState } = fakeDoc("visible");
    const cb = vi.fn();
    const stop = startVisibleInterval(cb, 30_000, doc);
    stop();
    expect(listeners.size).toBe(0);
    vi.advanceTimersByTime(90_000);
    setState("visible");
    expect(cb).not.toHaveBeenCalled();
  });
});
