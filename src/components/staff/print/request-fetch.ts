import { toastApiError, toastError } from "@/lib/toast";

async function errorCode(res: Response): Promise<string | null> {
  try {
    const { error } = (await res.clone().json()) as { error?: unknown };
    return typeof error === "string" ? error : null;
  } catch {
    return null;
  }
}

// Appel JSON vers une route staff ; en cas d'erreur, le message français de l'API est affiché
// en toast et la fonction renvoie null.
// `codeMessages` remplace le message de l'API pour certains codes d'erreur (champ `error`).
export async function staffRequest(
  url: string,
  method: string,
  body?: unknown,
  codeMessages?: Record<string, string>,
): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const code = codeMessages ? await errorCode(res) : null;
      if (code && codeMessages?.[code]) toastError(codeMessages[code]);
      else await toastApiError(res);
      return null;
    }
    return res;
  } catch (err) {
    await toastApiError(err);
    return null;
  }
}

// `apiBase` remplace la base plateforme (ex. route d'un événement) ; `path` s'y ajoute tel quel.
export const requestUrl = (requestId: string, path = "", apiBase?: string) =>
  `${apiBase ?? `/api/platform/print/requests/${requestId}`}${path}`;
