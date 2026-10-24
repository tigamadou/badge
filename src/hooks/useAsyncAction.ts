"use client";

import { useCallback, useRef, useState } from "react";
import { toastApiError, toastSuccess } from "@/lib/toast";

export type AsyncActionOptions<T> = {
  success?: string;
  error?: string;
  onSuccess?: (result: T) => void;
};

// Logique testable sans DOM (Vitest tourne en environnement node).
export async function runAsyncAction<T>(
  action: () => Promise<T>,
  options: AsyncActionOptions<T> | undefined,
  guard: { current: boolean },
  setPending: (pending: boolean) => void,
): Promise<void> {
  if (guard.current) return;
  guard.current = true;
  setPending(true);
  try {
    const result = await action();
    options?.onSuccess?.(result);
    if (options?.success) toastSuccess(options.success);
  } catch (err) {
    // `options.error` n'est que le repli : le message de l'API, déjà en français, passe devant.
    await toastApiError(err, options?.error);
  } finally {
    guard.current = false;
    setPending(false);
  }
}

// L'action lève la `Response` quand `!res.ok` (`if (!res.ok) throw res;`).
export function useAsyncAction<T>(
  action: () => Promise<T>,
  options?: AsyncActionOptions<T>,
): { run: () => Promise<void>; pending: boolean } {
  const [pending, setPending] = useState(false);
  // Un ref (et non `pending`) : deux appels dans le même tick voient l'état React périmé.
  const guardRef = useRef(false);
  const run = useCallback(
    () => runAsyncAction(action, options, guardRef, setPending),
    [action, options],
  );
  return { run, pending };
}
