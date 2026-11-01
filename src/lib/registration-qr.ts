// QR d'accueil d'une inscription : URL de vérification et décodage du contenu scanné.

/** URL publique de vérification encodée dans le QR du badge et dans le QR d'accueil. */
export function registrationVerifyUrl(baseUrl: string, registrationId: string): string {
  return `${baseUrl.replace(/\/$/, "")}/verify/${encodeURIComponent(registrationId)}`;
}

/** Extrait l'ID d'inscription d'un contenu de QR (URL de vérification ou ID brut). */
export function parseRegistrationQr(payload: string): string {
  const trimmed = payload.trim();
  const match = trimmed.match(/\/verify\/([A-Za-z0-9-]+)/);
  if (match) return match[1];
  return trimmed;
}
