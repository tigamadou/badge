// Valide une destination de redirection fournie par l'utilisateur (parametre `next`).
// Seul un chemin interne est accepte : ni URL absolue, ni protocol-relative (`//host`),
// ni backslash (que certains navigateurs normalisent en `/`). Renvoie null si invalide,
// a charge de l'appelant de retomber sur sa destination par defaut -- jamais d'erreur
// exposant la valeur recue.
export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.startsWith("/\\")) return null;
  return value;
}
