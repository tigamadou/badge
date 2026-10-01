// Consignes de securite d'un evenement : une liste de textes imprimee sur le
// badge (variable `list` d'un template, source event.securityInstructions).
// Memes bornes que le moteur de rendu (30 consignes, 500 caracteres) : une saisie
// acceptee ici est toujours imprimable.
export const MAX_SECURITY_INSTRUCTIONS = 30;
export const MAX_SECURITY_INSTRUCTION_CHARS = 500;

export function cleanSecurityInstructions(items: string[]): string[] {
  return items.map((item) => item.trim()).filter((item) => item !== "");
}

// Saisie du formulaire : une consigne par ligne.
export function linesToInstructions(text: string): string[] {
  return cleanSecurityInstructions(text.split(/\r?\n/));
}

// Colonne JSON nullable : tout ce qui n'est pas un tableau vaut « aucune
// consigne », et seuls les elements textuels sont gardes. Le rendu d'un badge ne
// doit jamais echouer sur une valeur ecrite a la main en base.
export function readSecurityInstructions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return cleanSecurityInstructions(value.filter((item): item is string => typeof item === "string"));
}
