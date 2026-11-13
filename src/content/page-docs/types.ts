// Types partagés par les modules générés (manifest.generated.ts, index.generated.ts) et la logique serveur.
export type PageDocSpace = "platform" | "org" | "event" | "account";
export type PageDocAudience = "organisateur" | "staff" | "participant";

/** Entrée sans corps : sûre côté client (module `index.generated.ts`). */
export interface PageDocIndexEntry {
  id: string;
  route: string;
  space: PageDocSpace;
  title: string;
  audience: PageDocAudience;
  /** Permission exigée par la garde de la page, quand elle en a une. */
  access?: string;
  updatedAt: string;
}

/** Entrée complète avec le corps Markdown : serveur uniquement (module `manifest.generated.ts`). */
export interface PageDocEntry extends PageDocIndexEntry {
  body: string;
}
