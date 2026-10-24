import { toast } from "sonner";

export const DEFAULT_ERROR_MESSAGE = "Une erreur est survenue. Réessayez.";

export function toastSuccess(message: string): void {
  toast.success(message);
}

export function toastError(message: string): void {
  toast.error(message);
}

function readErrorField(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const error = (value as { error?: unknown }).error;
  return typeof error === "string" && error !== "" ? error : null;
}

// Lit le champ `error` du format API `{ code, error }` ; tout autre cas (corps non JSON,
// corps déjà lu, erreur réseau) affiche le repli, jamais un message technique.
export async function toastApiError(
  source: unknown,
  fallback: string = DEFAULT_ERROR_MESSAGE,
): Promise<void> {
  let message: string | null = null;
  if (source instanceof Response) {
    try {
      message = readErrorField(await source.json());
    } catch {
      message = null;
    }
  } else {
    message = readErrorField(source);
  }
  toast.error(message ?? fallback);
}
