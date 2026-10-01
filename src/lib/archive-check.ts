// Controle local avant tout envoi : extension et taille. La lecture du paquet reste
// le travail du serveur.
export function checkArchiveFile(file: { name: string; size: number }, maxBytes: number): string | null {
  if (!file.name.toLowerCase().endsWith(".zip")) return "Seules les archives .zip sont acceptées.";
  if (file.size > maxBytes) return `Archive trop lourde : ${Math.round(maxBytes / (1024 * 1024))} Mo au plus.`;
  return null;
}
