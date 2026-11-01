"use client";

import { useEffect, useRef } from "react";

// Sous-ensemble de `Document` utilisé ici (un faux document suffit aux tests).
export type VisibilityDoc = {
  visibilityState: string;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
};

// Logique pure (testable sans DOM) : appelle `callback` toutes les `ms` tant que la page est
// visible, et une fois au retour de visibilité. Renvoie la fonction d'arrêt.
export function startVisibleInterval(callback: () => void, ms: number, doc: VisibilityDoc): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;
  const stopTimer = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
  };
  const startTimer = () => {
    stopTimer();
    timer = setInterval(callback, ms);
  };
  const onChange = () => {
    if (doc.visibilityState === "visible") {
      callback();
      startTimer();
    } else {
      stopTimer();
    }
  };
  if (doc.visibilityState === "visible") startTimer();
  doc.addEventListener("visibilitychange", onChange);
  return () => {
    stopTimer();
    doc.removeEventListener("visibilitychange", onChange);
  };
}

// Rappelle `callback` toutes les `ms` quand l'onglet est visible (dernier callback utilisé).
export function useVisibleInterval(callback: () => void, ms: number): void {
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  });
  useEffect(() => startVisibleInterval(() => ref.current(), ms, document), [ms]);
}
