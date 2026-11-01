# Architecture - Badge v4

> Ce document decrit l'etat cible v4. Le code fait foi ; en cas de divergence,
> mettre a jour ce fichier dans le meme changement.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 5 · Prisma 6 · MySQL 8 ·
NextAuth (Credentials/JWT) · Tailwind 4 · Vitest 4 · Playwright · Caddy ·
`@aws-sdk/client-s3` + RustFS (dev/CI/preprod/prod).

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
S3-compatible (`@aws-sdk/client-s3`, `forcePathStyle` pour RustFS). API publique
inchangee (`uploadFile`/`getFile`/`deleteFile`) + `deletePrefix` pour l'archivage
par prefixe. Service `rustfs` en dev (ports 9000/9001) comme en prod (reseau interne).
Variables `S3_ENDPOINT` / `S3_REGION` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` /
`S3_BUCKET`. Voir la [spec S3](specs/2026-05-31-v4-stockage-s3-et-backups.md).

Les documents de profil (`profile/{userId}/documents/...`) sont **sensibles** :
`/api/files` ne les sert qu'a leur proprietaire et au staff plateforme
(`ctx.isStaff`). Les photos (`profile/{userId}/photos/...`) restent publiques
(elles figurent sur les badges). Le composant `DocumentPreview`
(`src/components/ui/`) rend un apercu cliquable et affiche un etat
« non consultable ici » quand le visiteur n'a pas le droit de lire le fichier.

## Contrat des listes d'inscriptions

Les routes de liste d'inscriptions renvoient un **DTO aplati** via
`toRegistrationListDTO` (`src/lib/registration-dto.ts`) : les champs metier
(`firstName`, `email`, `structure`, ...) et jamais les cles `snapshot*`, qui sont
un detail de persistance. Un test d'integration asservit ce contrat.

Les colonnes `snapshot*` d'une `Registration` sont **figees a l'approbation**, pas a la
creation : tant qu'une inscription est en attente, une modification du profil participant
la realigne (`src/lib/registration-snapshot-sync.ts`, appele par
`PUT /api/account/profile`). Une inscription `APPROVED` ne change plus -- le badge emis et
la verification publique doivent refleter l'identite au moment de la decision. Une
inscription `REJECTED` passe par la resoumission, qui reecrit deja le snapshot. Une
inscription dont l'evenement bloque le nouveau numero de piece est laissee intacte, et
chaque inscription touchee produit un `REGISTRATION_SNAPSHOT_REFRESHED` au journal.

## Details d'un evenement

Le modele `Event` porte, en plus de `date`, deux champs optionnels **purement
informatifs** : `endDate` (date de fin, `>= date`) et `description` (texte brut,
rendu avec preservation des sauts de ligne). `date` reste la seule date de
reference metier : ID de badge (`generate-id.ts`), ouverture/cloture des
inscriptions et archivage ne s'appuient jamais sur `endDate`. Le helper
`formatEventPeriod(date, endDate)` (`src/lib/format-date.ts`) produit le libelle
de periode (date seule, ou « Du … au … »), et le composant `EventInfoCard`
(`src/components/event/`) presente le bloc d'informations en variantes `public`
et `staff`.

## Templates de badge (plans 10 à 12)

Un template de badge est une **donnée**, jamais du code : la table
`InstalledBadgeTemplate` porte des manifestes JSON téléversés par le staff plateforme sans
déploiement. Les deux modèles livrés (`default`, `recto-verso`) n'ont aucun statut
particulier — leurs manifestes vivent sous `prisma/badge-templates/` et sont installés par
le seed, par le même chemin de code qu'un paquet téléversé.

`src/lib/badge-templates/resolve.ts` est la porte d'entrée unique : `resolveTemplate(id)`
rend le template et retombe sur la famille `default` en journalisant,
`templateExists(id)` valide une saisie sans repli, et `listAvailableTemplates()` rend ce
qui est proposable. La garantie qu'un template par défaut existe est portée par le **seed**
et non par le schéma ; si la famille `default` manque, la résolution échoue bruyamment en
nommant `make db-seed`.

Chaque installation crée une **version figée** : réinstaller ajoute une ligne, ne met
jamais à jour. L'identifiant stocké par la cascade `Event → Org → Platform` est le `cuid`
de la ligne, si bien qu'un événement ne peut pas voir son badge changer. Un template
archivé reste **résolvable** — il disparaît du sélecteur, pas des badges existants.

Le moteur de rendu est le package `@tigamadou/pdf-engine`, publié depuis pdfStudio sur GitHub Packages. Monter de version : `yarn add @tigamadou/pdf-engine@<version>`, puis `make verify-engine` (voir « Monter de version le moteur »).
Il est pur — ni Prisma, ni stockage, ni réseau —
et ne connaît aucun nom métier : il reçoit un manifeste, un résolveur de ressources et des
valeurs de variables. L'ouverture d'archive est confinée au sous-chemin `@tigamadou/pdf-engine/package`, qui
applique toutes les bornes de sécurité avant extraction. Le vocabulaire du domaine badge
reste hors du moteur, dans le code dont l'application est propriétaire :
`bindings.ts` (les 15 sources et leur type, validation et suggestion de la table de
liaison stockée dans `InstalledBadgeTemplate.bindings`) et `build-values.ts` (lecture du
contexte d'un badge vers les valeurs des variables, selon cette table). Détail :
[`features/templates-badges.md`](features/templates-badges.md).

## Validation des profils (plans 08 et 09)

L'identité d'un participant est validée par le **staff plateforme**.
`User.profileStatus` (`INCOMPLETE → PENDING → APPROVED | REJECTED`) est un miroir
dénormalisé de la dernière `ProfileSubmission` (lignes immuables) ; **seul
`src/lib/profile-review.ts` l'écrit**. Déposer ses pièces suffit pour s'inscrire :
`canRegisterToEvent()` autorise `PENDING` et `APPROVED`, et les gates
register/resubmit/création staff renvoient 403 `PROFILE_NOT_SUBMITTED` pour
`INCOMPLETE` et `REJECTED`. Le gel de l'approbation côté organisation (409
`PROFILE_NOT_APPROVED`, qui exige `APPROVED`) est la seule barrière restante. Le rejet de profil et le rejet
d'inscription puisent dans le catalogue `RejectionReason` (portée `PROFILE` /
`REGISTRATION` / `BOTH`). Détail : [`features/validation-profils.md`](features/validation-profils.md).

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

**Blocage** : le layout `org/[orgId]` lit les droits de l'abonnement. L'onglet
`/subscription` et la liste des evenements restent toujours accessibles ; le reste
de l'espace org suit le droit `ACCESS_ORG_SPACE` (sinon un ecran bloquant le remplace),
et les evenements en cours restent exploitables (`MANAGE_ONGOING_EVENTS`). Le
layout ne calcule que `canAccessOrgSpace` ; le composant client `OrgAccessGate`
(`usePathname`) decide d'apres le pathname courant d'afficher la page ou l'ecran
bloquant, y compris en navigation douce. Voir [features/abonnements.md](features/abonnements.md).

> Migration : le retrait des colonnes `quota*` est destructif. En dev via
> `make db-push` ; une migration Prisma versionnee est requise avant tout
> deploiement prod (v1 est en production et partage le schema Prisma).

## HTTPS local

Caddy sert `*.badge.local` en HTTPS via sa CA interne (`tls internal`, 443 expose,
http redirige vers https). L'app se sait servie en `https://badge.local`
(`NEXTAUTH_URL`). Voir [installation.md](installation.md) pour la confiance CA.
