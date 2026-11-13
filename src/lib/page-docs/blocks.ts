import { PERMISSION_KEYS, permissionDef, type Permission } from "@/lib/permissions/catalog";

const OPEN_RE = /^:::permission(?:\s+(.*))?$/;

/**
 * Applique les blocs `:::permission <clé>` … `:::` d'un corps Markdown.
 * `decide(clé)` : true = garder le contenu, false = retirer le bloc entier, undefined = garder le
 * contenu avec la mention « Réservé… » (portée différente de la cible évaluée).
 * Un bloc mal formé (non fermé, imbriqué, clé vide, marqueur isolé) ne casse jamais le rendu :
 * le texte est conservé et les marqueurs sont retirés.
 */
export function filterPermissionBlocks(body: string, decide: (key: string) => boolean | undefined): string {
  const lines = body.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const text = lines[i].trim();
    if (!text.startsWith(":::")) {
      out.push(lines[i]);
      i++;
      continue;
    }
    const open = text === ":::" ? null : OPEN_RE.exec(text);
    const key = (open?.[1] ?? "").trim();
    if (!open || key === "") {
      i++; // marqueur isolé, inconnu ou sans clé : retiré, texte conservé
      continue;
    }
    let end = i + 1;
    while (end < lines.length && !lines[end].trim().startsWith(":::")) end++;
    const closed = end < lines.length && lines[end].trim() === ":::";
    if (!closed) {
      i++; // non fermé ou imbriqué : seul le marqueur d'ouverture est retiré
      continue;
    }
    const inner = lines.slice(i + 1, end);
    const decision = decide(key);
    if (decision === true) out.push(...inner);
    else if (decision === undefined) out.push(`*Réservé aux utilisateurs disposant de la permission « ${labelOf(key)} ».*`, "", ...inner);
    i = end + 1;
  }
  return out.join("\n");
}

function labelOf(key: string): string {
  return PERMISSION_KEYS.has(key) ? permissionDef(key as Permission).label : key;
}
