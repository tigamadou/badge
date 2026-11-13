# Feature — Rôles et permissions

> **Statut** : En construction — chantier `roles-permissions`
> **Spec** : [37 — rôles et permissions](../specs/2026-11-13-37-v4-roles-et-permissions.md) (coordination : spec 36)
> **Plan du socle** : [2026-11-13-1-socle-roles-docs](../plans/2026-11-13-1-socle-roles-docs.md)

Cette page est remplie par lot : chaque lot rédige sa section. Le socle est décrit ci-dessous ;
les autres sections sont à rédiger par leur lot.

---

## Socle : modèle, catalogue et résolution

### Rôles en base, catalogue en code

- **Catalogue** (`src/lib/permissions/catalog.ts`) : 98 permissions atomiques
  (56 plateforme, 18 organisation, 20 évènement, 4 participant). Chaque entrée porte
  `{ key, scope, domain, label, description, reserved? }`. Le type `Permission` est dérivé du
  catalogue. Quatre clés sont `reserved` (gestion des droits : `platform.roles.manage`,
  `users.permissions.manage`, `org.roles.manage`, `org.members.permissions.manage`) : elles
  n'existent que dans les rôles système qui les portent et ne se cochent ni dans un rôle
  personnalisé ni par ajustement.
- **Rôles** (tables `Role`, `RolePermission`, `UserPermissionOverride`) : un rôle est un
  ensemble de permissions. `User.platformRoleId`, `OrgMembership.roleId` et
  `EventMembership.roleId` le référencent (nullables pendant la transition).
- Le rôle `PARTICIPANT` est implicite pour tout compte (aucune colonne).

### Rôles système figés

Quatorze rôles système, lignes `Role` identifiées par `systemKey` :

| Niveau | Rôles |
|---|---|
| Plateforme | `SUPER_ADMIN`, `STAFF_ADMIN`, `STAFF_SUPPORT`, `STAFF_PRINTER` (Imprimeur), `STAFF_OBSERVER` |
| Organisation | `OWNER`, `MANAGER`, `AUDITOR`, `AGENT` |
| Évènement | `ADMIN`, `OPERATOR`, `PRINTER`, `VIEWER` |
| Participant | `PARTICIPANT` |

Leurs permissions vivent **dans le code** (`src/lib/permissions/system-roles.ts`), pas en
base : un rôle système n'a aucune ligne `RolePermission` et ne change qu'avec le code. Pour un
réglage différent, on duplique en rôle personnalisé ou on ajuste l'utilisateur. Le `SUPER_ADMIN`
détient toutes les permissions des niveaux plateforme, organisation et évènement. La
fonction `ensureSystemRoles(db)` (`src/lib/permissions/db.ts`) les crée ou met à jour de
façon idempotente (upsert par `systemKey`) et renvoie leurs ids.

Changements de comportement assumés par la spec 37 : l'Observateur est en lecture seule chez
les clients, `STAFF_SUPPORT` perd la production d'impression (passée à `STAFF_PRINTER`),
`users.update` est réservé à `STAFF_ADMIN` et au-dessus.

### Niveaux et « Qui peut porter quoi »

| Rôle de niveau | Peut contenir des permissions de niveau |
|---|---|
| PLATFORM | PLATFORM, ORG, EVENT (toutes les organisations et tous les évènements) |
| ORG | ORG, EVENT (tous les évènements de l'organisation) |
| EVENT | EVENT |
| PARTICIPANT | PARTICIPANT |

Constante `ROLE_SCOPE_ALLOWS` (`system-roles.ts`).

### Ordre de résolution

`effectivePermissions(ctx, target)` (`src/lib/permissions/resolve.ts`, fonctions pures) calcule,
pour une cible `platform | org | event | participant` :

1. la **base** : union du rôle plateforme, du rôle d'organisation (cibles `org` et `event`), du
   rôle de membre d'évènement (cible `event`) ; le rôle `PARTICIPANT` pour la cible participant ;
2. les **ajustements plateforme** (`orgId = null`) : `GRANT` ajoute, `REVOKE` retire ;
3. les **ajustements d'organisation** (`orgId` de la cible) : idem ;
4. à un même niveau, `REVOKE` l'emporte sur `GRANT` ;
5. toute clé dont le niveau ne correspond pas à la cible est ignorée.

Changement visible : le rôle d'organisation et le rôle d'évènement s'**additionnent** (un
`AUDITOR` d'organisation membre `PRINTER` d'un évènement est `VIEWER` et `PRINTER`) ; l'ancien
comportement faisait remplacer l'un par l'autre. Cette union ne vaut que pour les nouvelles
API (`permission`, `requirePermission`, `hasPermission`) ; `minRole` / `role` / `effectiveRole`
gardent leur sémantique.

### Règle de cible

Une permission s'évalue toujours sur la cible de **la ressource touchée**. Une route
plateforme qui agit sur une ressource d'évènement (poste d'impression sur place, commande
d'impression) vérifie la clé EVENT sur la cible de cette ressource, construite par
`eventTargetOf({ eventId, orgId })` (exporté par `src/lib/permissions`) : les clés EVENT du
rôle plateforme s'y appliquent puisqu'elles valent pour tous les évènements.

### Repli sur les enums

Pendant la transition, `buildUserContext` résout chaque rôle ainsi : le `roleId` (rôle non
archivé) d'abord ; à défaut, la colonne d'enum héritée (`staffRole`, `OrgMembership.role`,
`EventMembership.role`) ; à défaut, aucun rôle (fermé par défaut). Un rôle archivé ne donne
aucune permission. Fabriques, seed et helpers e2e écrivent donc **les deux** (`roleId` et enum)
pour les rôles hérités. Les rôles sans enum (`STAFF_PRINTER`, `AGENT`, rôles personnalisés)
n'ont pas de clé héritée : les champs de compatibilité du contexte (`staffRole`,
`role`) valent `null` et **ils ne satisfont aucun contrôle hérité** (`minRole`, `role`).
Le code de compatibilité est marqué `@deprecated compat chantier roles-permissions` et
disparaît à la fusion.

### Contexte et gardes

- **`UserContext`** (`src/types/auth.ts`, construit par `src/lib/user-context.ts`) :
  identité, `isStaff`, `platformRole`, `orgMemberships`, `eventMemberships` (avec `roleRef`
  résolu), `overrides`, plus `staffRole` hérité. `loadUserContext(userId)` n'est pas mémoïsé
  (null si absent ou archivé) ; `getUserContext` l'est par requête (`cache()` de React) pour
  les pages. Aucune permission dans le JWT : un changement s'applique à la requête suivante.
- **`src/lib/auth-guards.ts`** : `requirePermission(userId, permission | liste, target)`
  (401 `NOT_AUTHENTICATED` si contexte nul, 403 `PERMISSION_DENIED` sinon ; une liste signifie
  « au moins une »), `loadPermissions(userId, target)` pour les Server Components (ensemble vide
  si contexte nul), `loadEventTarget(eventId)` (404 `EVENT_NOT_FOUND`) ; côté pages,
  `getEventTarget(eventId)` (`src/lib/event-org.ts`). Les gardes héritées (`requireStaff`,
  `requireOrgRole`, `requireEventRole`) restent, réimplémentées sur les rôles système.
- **Wrappers de routes** : `withStaffAuth(handler, { permission })` (cible plateforme,
  `permission` et `minRole` exclusifs), `withOrgAuth(permission | rôle, handler)` (cible
  organisation), `withEventAuth({ permission, allowArchived?, requireRegistrationOpen? }, handler)`
  (cible évènement). Chaque `permission` accepte une liste (« au moins une ») et doit être du
  bon niveau (erreur à la déclaration sinon).
- **`EventAuthCtx`** : `session`, `orgId`, `eventId`, `event` (`id`, `orgId`, `archived`,
  `registrationOpen`, `date`, `endDate`), `permissions` (ensemble effectif), `isStaffActor`
  (staff sans appartenance à l'organisation ni à l'évènement) et `effectiveRole` (déprécié).
- **Participant** : `requireParticipantPermission(permission)` (`src/lib/auth-participant.ts`)
  relit le compte : absent ou archivé → 401 `NOT_AUTHENTICATED` ; bloqué → 403
  `ACCOUNT_BLOCKED` ; permission absente → 403 `FORBIDDEN`.
- Codes d'erreur : `PERMISSION_DENIED` (403) s'ajoute aux codes existants. Pour les routes
  d'évènement, un `VIEWER` sans la permission obtient désormais `PERMISSION_DENIED` au lieu de
  `EVENT_FORBIDDEN` (même statut 403).
- **Règles « jamais le staff » en code** : les permissions `billing.subscription.pay` et
  `print.quote.accept` sont calculées pour le `SUPER_ADMIN` mais refusées à l'acteur staff :
  `assertOwner` (acceptation d'un devis) et `assertNotStaff` (création, soumission côté client)
  s'appuient sur `isStaffActor`. Un staff membre `OWNER` de l'organisation n'est pas un acteur
  staff et peut donc accepter (changement assumé).

### Notifications par permission

`RecipientSpec` (`src/lib/notifications/types.ts`) est soit `{ users: string[] }`, soit
`{ permission, target, includeStaff? }`. Les destinataires sont les **membres** de
l'organisation ou de l'évènement ciblé qui détiennent la permission (comptes actifs et non
bloqués, hors auteur, dédoublonnés, triés). `includeStaff` élargit au staff porteur : les anciens ciblages
par rôle excluaient le staff, d'où son absence par défaut. Effets visibles : le `PRINTER`
d'évènement n'est plus notifié à l'ouverture/fermeture des inscriptions ; le `STAFF_SUPPORT`
ne reçoit plus les messages d'impression.

### Fabriques et helpers e2e

- **Vitest** (`src/test/factories.ts`) : `makeStaff(role)`, `makeOrgMember(orgId, role)`,
  `makeEventMember(eventId, role)`, `makeCustomRole({ scope, orgId?, name?, permissions })`,
  `makeOverride({ userId, orgId?, permission, effect })`. Les rôles système sont écrits en base
  à la demande (le reset de test les efface).
- **Playwright** (`e2e/helpers/db.ts`) : `createTestStaff({ scope, role })`,
  `createTestOrgMember`, `createTestEventMember`, `createTestOrgWithOwner` ; les types de rôle
  acceptent `STAFF_PRINTER` et `AGENT` ; `loginAsStaff` / `loginAsOrgMember` /
  `loginAsEventMember` (`e2e/helpers/auth.ts`) sont inchangés. Le parcours de base du socle est
  couvert par `e2e/transverse/roles-socle.spec.ts`.

---

## Plateforme (lot 2a)

À rédiger par le lot 2a.

## Organisation et évènement (lot 2b)

À rédiger par le lot 2b.

## Gestion des droits (lot 2c)

Le lot 2c ajoute l'écriture : créer des rôles, attribuer un rôle par `roleId`, ajuster les permissions d'un compte, et protéger les routes participant. Le service est dans `src/lib/role-management/` ; les écrans partagés dans `src/components/permissions/`.

### Modèle

- **Rôles système** : figés par le code (voir « Rôles système figés »). Jamais modifiables ni archivables (`SYSTEM_ROLE`, 409) ; on les **duplique** pour partir d'un rôle personnalisé.
- **Rôles personnalisés** : une ligne `Role` et ses `RolePermission`. Un rôle plateforme n'a pas d'organisation ; un rôle d'organisation ou d'évènement appartient à une organisation (`orgId`). Nom unique par `(orgId, scope)` parmi les rôles non archivés (`ROLE_NAME_TAKEN`). Archivage logique (`archived`) ; un rôle attribué à au moins un compte n'est pas archivable (`ROLE_IN_USE`).
- **Ajustements** : `UserPermissionOverride`, par compte et par niveau (`orgId` nul = plateforme, sinon l'organisation). Trois états par permission : hérité (aucune ligne), ajouté (`GRANT`), retiré (`REVOKE`) ; un retrait l'emporte sur un ajout. L'écriture remplace l'ensemble des ajustements d'un niveau.
- **Compatibilité** : tant que le plan 3 n'a pas retiré les colonnes d'enum, chaque changement de rôle écrit `roleId` **et** la colonne d'enum correspondante (marqueur `@deprecated compat`).

### Qui peut quoi

| Action | Permission requise | Où |
|---|---|---|
| Gérer les rôles plateforme | `platform.roles.manage` (SUPER_ADMIN) | `/platform/roles` |
| Gérer les rôles d'une organisation | `org.roles.manage` (OWNER) | `/org/[orgId]/roles` |
| Ajuster les permissions d'un compte | `users.permissions.manage` (SUPER_ADMIN) | `/platform/users/[userId]/permissions` |
| Ajuster celles d'un membre d'organisation | `org.members.permissions.manage` (OWNER) | `/org/[orgId]/members/[userId]/permissions` |
| Inviter, changer le rôle, retirer un membre d'organisation | `org.members.manage` | `/org/[orgId]/members` |
| Idem pour un membre d'évènement | `event.members.manage` | `/event/[eventId]/members` |
| Créer un compte client / staff | `users.create` / `users.staff.create` | `/platform/users/new` |
| Changer le rôle plateforme d'un compte | `users.staff.assign_role` (et `users.staff.assign_top_role` pour un rôle supérieur) | fiche utilisateur |
| Gérer les propriétaires d'une organisation | `organizations.members.manage` | `/platform/organizations/[orgId]/members` |

Les sélecteurs de rôle (`RoleSelect`) listent les rôles système et personnalisés applicables ; ceux que l'acteur ne peut pas attribuer sont grisés avec la raison.

### Garde-fous et codes d'erreur

- **Anti-escalade** : on ne coche, n'ajoute ni n'attribue jamais une permission qu'on ne détient pas sur la cible (`PERMISSION_NOT_HELD`, 403). Exception : un staff sans appartenance peut attribuer un rôle **système** d'organisation ou d'évènement (son contenu est fixé par le code) ; les droits du niveau participant s'ajoutent sans être détenus.
- **Permissions `reserved`** : refusées dans les rôles personnalisés et les ajustements (`RESERVED_PERMISSION`, 403), absentes des éditeurs. Une clé inconnue ou d'un niveau non portable par le rôle : `INVALID_PERMISSION` (400) ; un rôle de portée inadaptée : `INVALID_ROLE` (400).
- **Pas d'auto-modification** : ni son propre rôle ni ses propres ajustements (`SELF_MODIFICATION`, 403).
- **Propriétaires** : un OWNER ne modifie ni ne retire un autre OWNER, sauf détenteur de `users.permissions.manage` (`OWNER_PROTECTED`, 403). Le dernier OWNER d'une organisation (`LAST_OWNER`) et le dernier SUPER_ADMIN effectif (`isStaff = true`) restent protégés (409).
- **IDOR** : `orgId` toujours pris dans le chemin ; un `roleId` d'une autre organisation, un `userId` non membre, un `membershipId` d'un autre évènement répondent 404 (`NOT_FOUND`).
- Toute écriture est journalisée : `ROLE_CREATED`, `ROLE_UPDATED`, `ROLE_ARCHIVED`, `ROLE_RESTORED`, `USER_PERMISSIONS_CHANGED` (avant / après dans `details`), `MEMBERSHIP_ROLE_CHANGED` (clé système, sinon nom du rôle).
- Le staff membre d'une organisation n'agit pas côté organisateur avec ses droits plateforme : les REVOKE plateforme du compte s'appliquent à son côté « membre », ses GRANT plateforme non.

### Pages et routes

- Pages : `/platform/roles` (onglets Plateforme, Organisation, Évènement ; seuls les rôles plateforme sont éditables), `/platform/roles/new?from=<roleId>`, `/platform/roles/[roleId]` ; `/org/[orgId]/roles?tab=org|event`, `/org/[orgId]/roles/new`, `/org/[orgId]/roles/[roleId]` ; pages d'ajustement plateforme et organisation. Accès sans le droit : redirection (`/platform`, `/org/[orgId]`, fiche ou liste de membres).
- API : `/api/platform/roles` (liste, création), `/api/platform/roles/[roleId]` (lecture, modification, `DELETE` = archivage), `.../restore`, `/api/platform/roles/assignable?scope=PLATFORM|ORG&orgId=` ; mêmes routes sous `/api/org/[orgId]/roles` ; `/api/platform/users/[userId]/permissions` et `/api/org/[orgId]/members/[userId]/permissions` (`GET` niveaux, `PUT` remplacement). Les routes de membres et d'utilisateurs reçoivent `roleId` / `platformRoleId` (plus de champ d'enum).

### Routes participant

`PUT /api/account/profile` (`account.profile.update`), `POST /api/account/upload` (`account.profile.upload`), `POST /api/account/registrations/[id]/resubmit` (`registration.self.resubmit`, la propriété de l'inscription reste vérifiée) et `POST /api/events/[slug]/register` (`registration.self.create`) passent par `requireParticipantPermission`. Un compte inexistant ou archivé avec session ouverte répond 401, un compte bloqué 403 `ACCOUNT_BLOCKED`, une permission retirée par ajustement 403. Les lectures (profil, inscriptions, notifications) restent permises à tout compte valide.

### Tests

Tests d'intégration sur la base `_test` (`src/lib/role-management/__tests__`, tests colocalisés des routes, `src/lib/__tests__/api-org-members.test.ts`, `api-event-members.test.ts`, `src/app/api/account/__tests__/participant-guard.test.ts`) ; composants purs dans `src/components/permissions/__tests__` ; e2e `e2e/platform/roles.spec.ts`, `e2e/org/roles.spec.ts`, `e2e/platform/user-permissions.spec.ts`, `e2e/org/member-permissions.spec.ts`, `e2e/public/account-permissions.spec.ts`.

---

## Migration et exploitation

- Le projet utilise `db push` : ce chantier **ajoute** les tables et colonnes de rôles et
  **garde** les colonnes d'enum (`staffRole`, `OrgMembership.role`, `EventMembership.role`),
  désormais facultatives. Elles seront supprimées par un changement ultérieur, après passage du
  script en production ; les `roleId` passeront alors en NOT NULL.
- **Ordre** : `make db-push` (schéma), puis `make migrate-roles` (remplissage des rôles).
- `make migrate-roles` (`scripts/migrate-roles.ts`, `migrateRoles` dans
  `src/lib/permissions/migrate.ts`) crée les rôles système, renseigne `platformRoleId` /
  `roleId` depuis les enums, **sans toucher aux colonnes d'enum**. Idempotent : il ne cible
  que les lignes sans `roleId`. `ARGS=--dry-run` simule (aucune écriture, pas même les rôles
  système). Le rapport donne les utilisateurs staff, membres d'organisation, membres
  d'évènement migrés et le nombre de lignes déjà migrées ; un second passage doit donner zéro.
- Seuls les comptes `isStaff = 1` sont migrés, et la migration n'écrit jamais `isStaff`
  (invariant : `isStaff = platformRoleId != null`). Un compte avec `staffRole` renseigné mais
  `isStaff = 0` n'est **pas** promu : il est compté dans le rapport (« comptes incohérents ») pour
  qu'un humain tranche. Requête de contrôle à lancer avant la migration :
  `SELECT id, email FROM User WHERE isStaff = 0 AND staffRole IS NOT NULL`.
- La transaction de migration a un délai de 60 s (`timeout`) et 10 s d'attente (`maxWait`).
- Le déploiement n'entre pas dans le périmètre du chantier : migration sur la base de dev
  seulement.
