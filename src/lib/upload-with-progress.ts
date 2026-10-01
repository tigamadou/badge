// Envoi d'un formulaire avec progression : fetch n'expose pas la progression de
// l'envoi, XMLHttpRequest si. La progression non mesurable compte pour 100 %.
export function uploadWithProgress(
  url: string,
  body: FormData,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<{ status: number; json: unknown }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    xhr.upload.onprogress = (e) => {
      onProgress(e.lengthComputable ? Math.round((e.loaded / e.total) * 100) : 100);
    };
    xhr.onload = () => {
      let json: unknown = null;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        // Corps non JSON (page d'erreur) : l'appelant se fie au statut.
      }
      resolve({ status: xhr.status, json });
    };
    xhr.onerror = () => reject(new Error("NETWORK"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}
