import { toast } from "sonner";

export const DEFAULT_ERROR_MESSAGE = "Une erreur est survenue. Réessayez.";

export function toastSuccess(message: string): void {
  toast.success(message);
}

export function toastInfo(message: string): void {
  toast.info(message);
}

export function toastError(message: string): void {
  toast.error(message);
}

// Erreur dont le message, en français, est destiné à l'utilisateur.
export class ActionError extends Error {}

// Messages anglais renvoyés par des routes de src/app/api (relevé du 2026-10-24) :
// lisibles pour un développeur, pas pour l'utilisateur.
const NON_USER_FACING_ERRORS = new Set([
  "Rate limited",
  "Not found",
  "Missing orgId",
  "Missing orgId or eventId",
  "Last OWNER cannot be removed",
  "Bad request",
]);

// Un code technique (`NOT_FOUND`, `Unauthorized`) ne contient pas d'espace.
function isReadable(text: string): boolean {
  return text.includes(" ") && !NON_USER_FACING_ERRORS.has(text);
}

function readBody(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const { message, error } = value as { message?: unknown; error?: unknown };
  if (typeof message === "string" && message !== "") return message;
  return typeof error === "string" && isReadable(error) ? error : null;
}

// Message à afficher pour une erreur d'action : ActionError, puis corps JSON d'une Response
// (`message`, sinon `error` lisible), sinon le repli (réseau, HTML, code technique).
export async function apiErrorMessage(
  source: unknown,
  fallback: string = DEFAULT_ERROR_MESSAGE,
): Promise<string> {
  if (source instanceof ActionError) return source.message;
  // Toute autre valeur (TypeError réseau, AbortError…) porte un message anglais : repli.
  if (!(source instanceof Response)) return fallback;
  let message: string | null = null;
  try {
    message = readBody(await source.json());
  } catch {
    message = null;
  }
  return message ?? fallback;
}

export async function toastApiError(source: unknown, fallback?: string): Promise<void> {
  toast.error(await apiErrorMessage(source, fallback));
}
