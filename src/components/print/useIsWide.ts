"use client";

import { useSyncExternalStore } from "react";

const WIDE_QUERY = "(min-width: 1280px)";

// Vrai à partir de `xl` : une seule disposition (colonnes ou onglets) est montée à la fois, pour ne
// pas dupliquer le fil (polling, lecture) ni les actions.
export function useIsWide(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(WIDE_QUERY);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}
