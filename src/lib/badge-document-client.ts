import type { HtmlDocument } from "@tigamadou/pdf-engine/html";

export const PREVIEW_UNAVAILABLE = "Aperçu indisponible, réessayer";

export function badgeDocumentUrl(orgId: string, eventId: string, badgeId: string): string {
  return `/api/org/${orgId}/events/${eventId}/badges/${badgeId}?format=html`;
}

export type BadgeDocumentResult = { ok: true; document: HtmlDocument } | { ok: false; message: string };

const failure = (message = PREVIEW_UNAVAILABLE): BadgeDocumentResult => ({ ok: false, message });

// Ne rejette jamais. Seul un document FIGE est accepte : <page-view> execute le script d'un
// document vivant dans une iframe de meme origine, et la route ne renvoie que des figes.
export async function fetchBadgeDocument(
  url: string,
  init: { signal?: AbortSignal; fetch?: typeof fetch } = {},
): Promise<BadgeDocumentResult> {
  try {
    const res = await (init.fetch ?? fetch)(url, { signal: init.signal });
    const body: unknown = await res.json();
    if (res.status === 503) {
      const message = (body as { message?: unknown } | null)?.message;
      return failure(typeof message === "string" ? message : PREVIEW_UNAVAILABLE);
    }
    const doc = body as Partial<HtmlDocument> | null;
    if (res.status !== 200 || typeof doc?.html !== "string" || doc.frozen !== true || !Array.isArray(doc.pages)) {
      return failure();
    }
    return { ok: true, document: doc as HtmlDocument };
  } catch {
    return failure();
  }
}
