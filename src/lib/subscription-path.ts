// Les pages de paiement vivent sous /org/<orgId>/subscription : le layout les laisse
// passer même quand l'abonnement est inactif.
export function isSubscriptionPath(pathname: string, orgId: string): boolean {
  const base = `/org/${orgId}/subscription`;
  return pathname === base || pathname.startsWith(`${base}/`);
}
