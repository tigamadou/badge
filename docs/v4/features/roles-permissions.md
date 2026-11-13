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

À rédiger par le lot 2c.

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
- Un compte avec `staffRole` renseigné mais `isStaff = 0` est promu `isStaff = 1` par la
  migration (`isStaff = platformRoleId != null`). Contrôle préalable :
  `SELECT COUNT(*) FROM User WHERE isStaff = 0 AND staffRole IS NOT NULL`.
- Le déploiement n'entre pas dans le périmètre du chantier : migration sur la base de dev
  seulement.
