# Feature — Separation complete des espaces (item 7)

> Vue d'ensemble dans [architecture.md](../architecture.md#les-trois-espaces-separation-complete).

## Probleme (avant v4)

Le staff "descendait" dans `/admin/[orgId]` (memes pages/nav que les membres org,
seule difference : une banniere), et les membres org descendaient dans l'espace
event partage avec les membres event. Vues imbriquees difficiles a raisonner.

## Solution v4

- Renommage : `/staff` -> `/platform`, `/admin` -> `/org` (pages + API).
- **Supervision staff dediee** : `/platform/organizations/[orgId]/**` (read-only :
  fiche, evenements, membres, abonnement, journal). Le staff n'entre plus dans
  `/org`. Shell `PlatformOrgShell` (sous-nav dans le StaffShell).
- **Pouvoir staff explicite** : `hasOrgRole(..., { allowStaff })`. Les routes API
  gardent le pouvoir staff (`allowStaff: true`) ; les layouts de pages `/org`
  redirigent le staff non-membre vers `/platform/organizations/[orgId]`.
- **Nav org filtree par role** effectif (AUDITOR / MANAGER / OWNER).

## Fichiers cles

- `src/middleware.ts` — prefixes proteges `/org`, `/platform`.
- `src/app/org/[orgId]/layout.tsx` — redirection staff -> supervision.
- `src/components/admin/OrgShell.tsx` — nav filtree par `orgRole`.
- `src/components/platform/PlatformOrgShell.tsx` + `src/app/platform/organizations/[orgId]/**`.
- `src/lib/auth-helpers.ts` (`hasOrgRole` avec `allowStaff`), `src/lib/auth-guards.ts`.

## Deviation d'execution

Le segment event reste `events/[eventId]` (pluriel) cote pages ET API ; le
passage au singulier `event/` est differe (cf. architecture.md).
