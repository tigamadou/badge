"use client";

import { useCallback, useRef, useState } from "react";
import { toastApiError, toastSuccess } from "@/lib/toast";

export type AsyncActionOptions<T> = {
  success?: string;
  error?: string;
  onSuccess?: (result: T) => void;
};

// Logique testable sans DOM (Vitest tourne en environnement node).
export async function runAsyncAction<T, A extends unknown[] = []>(
  action: (...args: A) => Promise<T>,
  options: AsyncActionOptions<T> | undefined,
  guard: { current: boolean },
  setPending: (pending: boolean) => void,
  args: A = [] as unknown as A,
): Promise<void> {
  if (guard.current) return;
  guard.current = true;
  setPending(true);
  try {
    const result = await action(...args);
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
// Les arguments de `run(...args)` sont transmis à l'action (actions par ligne).
export function useAsyncAction<T, A extends unknown[] = []>(
  action: (...args: A) => Promise<T>,
  options?: AsyncActionOptions<T>,
): { run: (...args: A) => Promise<void>; pending: boolean } {
  const [pending, setPending] = useState(false);
  // Un ref (et non `pending`) : deux appels dans le même tick voient l'état React périmé.
  const guardRef = useRef(false);
  const run = useCallback(
    (...args: A) => runAsyncAction(action, options, guardRef, setPending, args),
    [action, options],
  );
  return { run, pending };
}
