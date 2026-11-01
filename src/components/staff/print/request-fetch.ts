import { toastApiError } from "@/lib/toast";

// Appel JSON vers une route staff ; en cas d'erreur, le message français de l'API est affiché
// en toast et la fonction renvoie null.
export async function staffRequest(url: string, method: string, body?: unknown): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      await toastApiError(res);
      return null;
    }
    return res;
  } catch (err) {
    await toastApiError(err);
    return null;
  }
}

export const requestUrl = (requestId: string, path = "") => `/api/platform/print/requests/${requestId}${path}`;
