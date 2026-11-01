// Les pages de paiement vivent sous /org/<orgId>/subscription : le layout les laisse
// passer même quand l'abonnement est inactif.
export function isSubscriptionPath(pathname: string, orgId: string): boolean {
  const base = `/org/${orgId}/subscription`;
  return pathname === base || pathname.startsWith(`${base}/`);
}

// Pages toujours accessibles hors réglage des droits : l'onglet Abonnement (et ses
// pages de retour) et la liste des évènements (exactement, avec ou sans « / » final).
export function isAlwaysAllowedOrgPath(pathname: string, orgId: string): boolean {
  if (isSubscriptionPath(pathname, orgId)) return true;
  const events = `/org/${orgId}/events`;
  return pathname === events || pathname === `${events}/`;
}
