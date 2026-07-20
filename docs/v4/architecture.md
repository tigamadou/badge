# Architecture - Badge v4

> Ce document decrit l'etat cible v4. Le code fait foi ; en cas de divergence,
> mettre a jour ce fichier dans le meme changement.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 5 · Prisma 6 · MySQL 8 ·
NextAuth (Credentials/JWT) · Tailwind 4 · Vitest 4 · Playwright · Caddy ·
`@aws-sdk/client-s3` + MinIO.

## Les trois espaces (separation complete)

La v4 supprime les vues imbriquees : chaque niveau hierarchique a son propre
espace de routes, sans reutiliser les vues du niveau inferieur.

| Espace | Prefixe pages | Prefixe API | Acces |
|---|---|---|---|
| Staff applicatif | `/platform/**` | `/api/platform/**` | `isStaff` (StaffRole) |
| Organisation | `/org/[orgId]/**` | `/api/org/[orgId]/**` | membres org (OWNER/MANAGER/AUDITOR) |
| Evenement | `/org/[orgId]/events/[eventId]/**` | `/api/org/[orgId]/events/[eventId]/**` | roles event + heritage org |

Renommage v4 : ancien `/staff` -> `/platform`, ancien `/admin` -> `/org`.

> **Note segment event** : le segment reste `events/[eventId]` (pluriel) cote
> pages ET API. Le passage cosmetique au singulier `event/` a ete differe lors de
> l'execution (page-paths et API-paths partagent `events/${eventId}`, un
> remplacement fiable sans casser les fetch API est trop fragile pour un sed).

### Fin des vues imbriquees

- Le **staff** ne "descend" plus dans `/org/[orgId]`. Il supervise chaque org en
  **lecture seule** via `/platform/organizations/[orgId]/**` (fiche, evenements,
  membres, abonnement, journal) — shell `PlatformOrgShell` (sous-nav dans le
  StaffShell). Le layout `/org/[orgId]` redirige tout staff non-membre vers
  `/platform/organizations/[orgId]`.
- La nav de l'espace org (`OrgShell`) est **filtree par role effectif** :
  AUDITOR (tableau de bord, evenements, journal), MANAGER (+ membres, modeles),
  OWNER (+ parametres).

## RBAC

`src/lib/auth-helpers.ts` (fonctions pures) + `src/lib/auth-guards.ts` (guards
async pour les routes API). Hierarchies :

- **StaffRole** : `SUPER_ADMIN > STAFF_ADMIN > STAFF_SUPPORT > STAFF_OBSERVER`.
- **OrgRole** : `OWNER > MANAGER > AUDITOR`.
- **EventRole** : partielle `ADMIN > OPERATOR > { PRINTER, VIEWER }`.

### Pouvoir staff explicite (v4)

`hasOrgRole(ctx, orgId, role, { allowStaff })` : le staff n'obtient le role org
**que** si `allowStaff: true` est demande explicitement. Les routes API
(`requireOrgRole`) passent `allowStaff: true` (pouvoir d'action staff conserve,
audit `staffActor`). Les **layouts de pages** appellent sans `allowStaff`, ce qui
sort le staff de l'espace org vers sa supervision. Fin de l'ancien bypass
implicite `if (ctx.isStaff) return true`.

## Deconnexion

`src/components/auth/LogoutButton.tsx` (client) : bouton -> modal de confirmation
(`components/ui/Modal`) -> `signOut({ callbackUrl: "/" })`. Cable dans StaffShell,
`account/layout`, OrgShell. Plus aucun lien direct vers `/api/auth/signout`.

## Roles a la creation

Choix du role expose partout : invitation membre org (`OrgMemberForm`, OWNER/
MANAGER/AUDITOR), invitation membre event, creation staff/user, et endpoint staff
`/api/platform/organizations/[orgId]/owners` (generalise a tous les roles org avec
form dans la supervision). Le code mort v1 `UserForm` est supprime.

## Stockage

`src/lib/storage.ts` bascule d'un stockage filesystem local vers un driver
S3-compatible (`@aws-sdk/client-s3`, `forcePathStyle` pour MinIO). API publique
inchangee (`uploadFile`/`getFile`/`deleteFile`) + `deletePrefix` pour l'archivage
par prefixe. Service `minio` en dev (ports 9000/9001) et prod (reseau interne).
Variables `S3_ENDPOINT` / `S3_REGION` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` /
`S3_BUCKET`. Voir la [spec S3](specs/2026-05-31-v4-stockage-s3-et-backups.md).

## Abonnements

Remplacement des champs `quotaMaxEvents` / `quotaMaxRegistrations` /
`quotaMaxStorageMB` de `Organization` par un catalogue `Plan` + une `Subscription`
par org (statut + dates, sans montant, overrides par org). Limites appliquees :
nombre d'evenements par org et nombre de participants **par evenement**.
Enforcement : bloquer les creations au-dela de la limite ou si l'abonnement est
echu ; existant consultable ; bypass staff audite.

**Periodicite** : `period` (`MONTHLY` = 30 j, `ANNUAL` = 365 j) pilote le calcul
de `startDate`/`endDate` a l'assignation (`computeSubscriptionDates`) ; le staff
ne saisit plus de dates.

**Blocage** : sans abonnement actif, le layout `org/[orgId]` remplace tout le
contenu par un ecran bloquant, sauf l'onglet `/subscription` (lecture seule). Le
pathname arrive via le header `x-pathname` pose par le middleware (Edge, sans
acces Prisma). Voir [features/abonnements.md](features/abonnements.md).

> Migration : le retrait des colonnes `quota*` est destructif. En dev via
> `make db-push` ; une migration Prisma versionnee est requise avant tout
> deploiement prod (v1 est en production et partage le schema Prisma).

## HTTPS local

Caddy sert `*.badge.local` en HTTPS via sa CA interne (`tls internal`, 443 expose,
http redirige vers https). L'app se sait servie en `https://badge.local`
(`NEXTAUTH_URL`). Voir [installation.md](installation.md) pour la confiance CA.
