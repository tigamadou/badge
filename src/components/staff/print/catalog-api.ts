import { ActionError } from "@/lib/toast";
import { uploadWithProgress } from "@/lib/upload-with-progress";

export const PRODUCTS_API = "/api/platform/print/products";

// Envoie un corps JSON ; une réponse en erreur est levée telle quelle (toast via useAsyncAction).
export async function sendJson(url: string, method: "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<void> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw res;
}

export const VALIDATION_MESSAGE = "Certaines valeurs sont invalides. Vérifiez les champs.";

// Téléverse une image du catalogue et renvoie sa clé de stockage (erreurs 413/415 : ActionError).
export async function uploadProductImage(file: File): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  const { status, json } = await uploadWithProgress("/api/platform/upload?context=print-product", form, () => {});
  const body = (json ?? {}) as { storageKey?: unknown; error?: unknown };
  if (status >= 200 && status < 300 && typeof body.storageKey === "string") return body.storageKey;
  throw new ActionError(
    typeof body.error === "string" && body.error.includes(" ") ? body.error : "Échec du téléversement de l'image.",
  );
}

// Entier >= 0 saisi dans un champ texte ; null si invalide.
export function parseInt0(text: string): number | null {
  const n = Number(text);
  return text.trim() !== "" && Number.isInteger(n) && n >= 0 ? n : null;
}
