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

Toute l'API `/api/platform/**` (hors `users/**`, `owners/**` et `roles/**`, lot 2c) et les pages
`/platform/**` sont gardées par une **clé du catalogue**, plus par un rôle minimal : une garde =
une clé, et le bouton d'un écran vient de la **même** clé que la route qu'il appelle.

### Mécanique

- **Routes** : `withStaffAuth(handler, { permission })` (cible plateforme, un compte non staff est
  refusé en `403 NOT_STAFF`, un droit manquant en `403 PERMISSION_DENIED`). Un second contrôle
  dans le handler passe par `permissionDenied(userId, clé, cible)`
  (`src/app/api/platform/permission-response.ts`) ; le contrôle d'un champ ou d'une variante
  utilise `hasPermission(ctx, clé, cible)` sur le contexte déjà chargé.
- **Pages** : `requirePlatformPage(clé)` (`src/app/platform/page-guard.ts`) : sans session,
  redirection vers `/login?callbackUrl=…` ; sans la clé, redirection vers `/platform`. Elle renvoie
  les permissions effectives, dont la page tire ses `canX` (props booléennes des composants).
- **Layout et menu** : `/platform` exige `platform.access` (sinon `/`). `StaffShell` construit son
  menu à partir des permissions (`buildStaffNav`) ; un groupe sans entrée disparaît (l'Imprimeur n'a
  pas le groupe « Plateforme », l'entrée « Rôles » est réservée à `platform.roles.manage`).
- **Onglets des paramètres** : `visibleSettingsTabs(permissions)` ; chaque onglet porte sa clé,
  l'URL d'un onglet masqué retombe sur le premier visible, aucun onglet visible renvoie à
  `/platform`.
- **Tests** : une matrice de refus (`src/app/api/platform/__tests__/permission-matrix.test.ts`)
  vérifie pour chaque route : 401 sans session, 403 pour un non-staff et pour chaque rôle hors de la
  liste autorisée, ni 401 ni 403 pour les rôles autorisés ; les variantes et les contrôles par champ
  ont des tests dédiés.

### Clés, routes, écrans et rôles

SA = `SUPER_ADMIN`, AD = `STAFF_ADMIN`, SU = `STAFF_SUPPORT`, PR = `STAFF_PRINTER`,
OB = `STAFF_OBSERVER`.

| Clé | Routes et écrans | Rôles |
|---|---|---|
| `platform.access` | layout `/platform`, tableau de bord, notifications, documentation | SA AD SU PR OB |
| `organizations.read` | liste, fiche, onglets et membres (lecture) d'une organisation, KPI du tableau de bord | SA AD SU OB |
| `organizations.create` / `update` / `archive` | création, édition, archivage et restauration (`OrgDetailActions` : `canArchive`) | SA AD |
| `organizations.delete` | suppression définitive (`OrgDetailActions` : `canDelete`) | SA |
| `organizations.members.manage` | formulaire d'invitation de la page Membres | SA AD |
| `subscriptions.update` | `PUT …/subscription` ; `SubscriptionForm` (`canEdit`, « Aucun abonnement. » sinon) | SA AD |
| `plans.read` / `plans.manage` | `/platform/plans` ; `PlanManager` (`canManage`) | lecture : SA AD SU OB ; gestion : SA AD |
| `profiles.read` / `profiles.review` | `/platform/profiles` ; approuver ou rejeter (`canDecide`) | lecture : SA AD SU OB ; décision : SA AD SU |
| `blocklist.read` / `blocklist.manage` | `blocked-emails`, `blocked-documents` | lecture : SA AD SU OB ; gestion : SA AD SU |
| `settings.read` | `GET/PATCH settings`, onglets E-mails, Sécurité, Abonnements | SA AD SU OB |
| `settings.update`, `settings.secrets.update`, `settings.subscription_rights.update` | contrôle **par champ** du `PATCH settings` (ci-dessous) ; `PlatformSettingsForm` (`canEdit`, secrets) | SA AD ; secrets : SA |
| `settings.smtp.test` | `POST settings/test-smtp`, `TestSmtpForm` | SA AD |
| `settings.badge_template.update`, `settings.onsite_print.update` | `PATCH settings/badge`, `PATCH settings/onsite-print` et leurs onglets | SA AD |
| `rejection_reasons.read` / `manage` | onglet Motifs et routes `rejection-reasons` | lecture : SA AD SU OB ; gestion : SA AD |
| `badge_templates.read` / `manage` | `/platform/badge-templates` (installation : `canInstall`), routes `badge-templates` | lecture : SA AD SU OB ; gestion : SA AD |
| `email_jobs.read` / `manage` | `/platform/jobs` ; relancer et annuler (`canAdmin`) | lecture : SA AD SU OB ; gestion : SA AD |
| `activity.read` | `/platform/activity`, détail, `GET activity` | SA AD SU OB |
| `payments.read` | `/platform/payments`, détail, reçu | SA AD SU OB |
| `print.requests.read` | commandes (liste, fiche, `items`, **`GET messages`**), pièces de commande de `/api/files` | SA AD PR OB (pas SU) |
| `print.requests.messages.send` / `reject` | `POST messages`, `reject` | SA AD PR |
| `print.requests.advance` | `POST status` (`START_PRODUCTION`, `MARK_READY`, `COMPLETE` en amont) | SA AD PR |
| `print.requests.onsite.complete` | `POST status` avec `to = COMPLETED` sur une commande sur place (`403 STAFF_FORBIDDEN` sinon) ; bouton « Terminer » | SA AD |
| `print.requests.reopen` / `quote.send` / `quote.edit` / `mark_paid` / `credit.apply` | rouvrir, envoyer le devis, éditer les lignes, marquer payée, appliquer le crédit | SA AD |
| `print.onsite.operate` | `onsite/lookup`, `search`, `print` et page du poste, **sur l'évènement de la commande** | SA AD PR |
| `print.onsite.margin.update` | `PATCH onsite/margin`, `OnsiteMarginForm` | SA AD |
| `print.catalog.read` / `manage` | `/platform/print/catalog*` ; produits, images, options, paliers | lecture : SA AD PR OB ; gestion : SA AD |
| `print.layouts.read` / `manage` | `/platform/print/layouts*`, routes `layouts` | lecture : SA AD PR OB ; gestion : SA AD |
| `print.sheets.read` / `generate` | `/platform/print/sheets/**`, routes `sheets*`, fichiers `print-sheets/` ; boutons « Générer » et « Regénérer » | SA AD PR |

### Arbitrages

- **`GET messages`** est gardé par `print.requests.read` (seul l'envoi l'est par
  `print.requests.messages.send`) pour ne pas retirer à l'Observateur la lecture du fil qu'il avait.
- **`PATCH settings` par champ** : un secret non vide exige `settings.secrets.update` (`403
  FORBIDDEN_SECRET_CHANGE`), `subscriptionRights` exige `settings.subscription_rights.update`, tout
  autre champ (ou un corps vide) exige `settings.update` (`403 PERMISSION_DENIED`) ; tout est vérifié
  avant la moindre écriture. La route elle-même exige `settings.read`.
- **L'Imprimeur** (`STAFF_PRINTER`) entre dans `/platform` sans groupe « Plateforme » : tableau de
  bord avec le seul bloc Impression, puis Commandes, Planches, Gabarits, Catalogue ; les espaces
  d'administration le renvoient à `/platform`. Il avance la production d'une commande en amont mais
  ne clôt pas une commande sur place et n'envoie ni devis ni paiement.
- **Pertes de droits assumées** : le Support n'a plus ni les commandes d'impression en lecture, ni
  les planches, ni les exports, ni la production ; l'Observateur n'a plus « Planches » ni les exports.
- **`/api/files`** : plus aucun passe-droit `isStaff`. `print-sheets/*` exige `print.sheets.read` ;
  `print-requests/{eventId}/…` et `print-requests/staff/{requestId}/…` exigent `print.requests.read`
  **ou** `print.request` sur l'évènement de la clé (ou de la commande nommée par la clé) ; toute
  autre forme `print-requests/…` exige `print.requests.read` ; `badge-exports/{eventId}/…` exige
  `badge.print` sur l'évènement ; `events/{id}/idDocuments/…` exige `event.read.detailed` sur
  l'évènement ; `profile/{uid}/documents/…` est lisible par son propriétaire ou par `profiles.read`.
- **Poste sur place** : la permission `print.onsite.operate` est évaluée sur l'évènement de la
  commande, après `loadOnsiteRequest` : une commande inexistante répond `404` aux rôles qui ont
  `platform.access`, et la page du poste redirige vers la fiche sans la permission.
- **Spec 38 (planches)** : vocabulaire du code conservé : `DONE` (et non `COMPLETED`), onglet « À
  traiter » ; la file garde les commandes dont la génération est `PENDING`, `RUNNING` ou `FAILED`
  (voir `impression-planches.md`).
- **Organisation** : le rôle d'un membre d'organisation se lit sur `roleRef` (page Membres, requête
  du propriétaire). `PlatformOrgShell` n'est pas filtré : tous ses onglets relèvent de
  `organizations.read`.

## Organisation et évènement (lot 2b)

Les espaces `/org/[orgId]` et `/event/[eventId]` ne testent plus de rôle : chaque garde, chaque
entrée de menu et chaque bouton lit une **permission** résolue par `effectivePermissions` (socle).
Le serveur reste l'autorité : le menu et les boutons masquent seulement ce que la route refuserait.

### Menus

Une seule table par espace (`src/components/admin/org-nav.ts`, `src/components/event/event-nav.ts`) sert le menu et
la page d'atterrissage. Un seul `EventShell` remplace les trois coques par rôle (opérateur, imprimeur,
observateur) ; le bandeau de rôle a disparu.

| Entrée de l'organisation | Permission (l'une d'elles) |
|---|---|
| Tableau de bord, Notifications, Documentation | `org.read` |
| Événements | `org.events.list` |
| Membres | `org.members.read` |
| Rôles (`/org/[orgId]/roles`, lot 2c) | `org.roles.manage` |
| Modèles catégories | `org.templates.read` |
| Abonnement | `billing.subscription.read` |
| Paiements | `billing.payments.read` |
| Paramètres | `org.update` |
| Journal | `org.activity.read` |

| Entrée de l'évènement | Permission (l'une d'elles) |
|---|---|
| Tableau de bord | `event.read.aggregated`, `event.read.detailed`, `scan.check-in` |
| Notifications, Documentation | toute permission sur l'évènement |
| Vue d'ensemble | `event.read.aggregated`, **sans** `event.read.detailed` (sinon Inscriptions la remplace) |
| Inscriptions, Catégories | `event.read.detailed` |
| Badges | `badge.print` |
| Impression | `print.request` (pastille des non-lus) |
| Poste sur place | `print.onsite.operate` |
| Scanner | `scan.check-in` |
| Membres | `event.members.manage` |
| Paramètres (groupe « Administration ») | `event.settings.update` |
| Journal (groupe « Administration ») | `event.activity.read` ou `scan.history.read` |

Résultat par rôle système : Propriétaire voit tout ; Gestionnaire ni Rôles ni Paramètres ; Auditeur la
consultation (sans Abonnement ni Paiements) ; **Agent** : Tableau de bord, Notifications, Événements, Documentation.
Dans un évènement, l'**Opérateur** a Inscriptions, Badges, Catégories, Scanner et Journal ; l'**Imprimeur** Notifications,
Badges et Documentation (sans groupe « Administration ») ; l'**Observateur** Tableau de bord et Vue d'ensemble ; l'**Agent**
Tableau de bord, Badges, Poste sur place, Scanner et Journal (ses scans).

### Pages gardées

Chaque page appelle `requireOrgPagePermission` / `requireEventPagePermission` (`_lib/page-access.ts`) en tête. Un refus
renvoie vers `/org/[orgId]` ou `/event/[eventId]` (jamais vers la page d'atterrissage elle-même : pas de boucle) ;
aucune permission du tout renvoie vers `/select`.

| Page de l'évènement | Permission |
|---|---|
| `registrations`, `registrations/[regId]`, `categories` | `event.read.detailed` |
| `blocked-emails`, `blocked-documents` | `registration.block` |
| `registrations/new` | `registration.create` |
| `registrations/overview` | `event.read.aggregated` |
| `badges`, `badges/[badgeId]`, `badges/print` | `badge.print` |
| `scan` | `scan.check-in` |
| `settings`, `settings/badge` | `event.settings.update` |
| `activity`, `activity/[logId]` | `event.activity.read` ou `scan.history.read` (sans la première : ses scans seulement) |
| `print/onsite`, `print/[requestId]/onsite` | `print.onsite.operate` |
| `notifications` | toute permission sur l'évènement |

Côté organisation, `events`, `events/new`, `activity`, `settings`, `settings/badge`, `templates`, `payments`, `subscription`
suivent les permissions des routes correspondantes (`org.events.list`, `org.events.create`, `org.activity.read`, `org.update`,
`org.badge_settings.update`, `org.templates.read`, `billing.payments.read`, `billing.subscription.read`).

### Page d'atterrissage

`/event/[eventId]` affiche le tableau de bord à qui détient `event.read.aggregated`, `event.read.detailed` ou
`scan.check-in` ; les autres sont envoyés sur la première entrée de leur menu (`firstAllowedEventHref`).
Le contenu dépend des permissions : compteurs et scans avec `event.read.aggregated` ; « Dernières inscriptions », quota
avec `event.read.detailed` ; bandeau d'images avec `event.settings.update` ; bloc « Mes scans » et bouton du scanner avec
`scan.check-in` ; bloc « Poste sur place » pour qui n'a pas la lecture des chiffres. L'Opérateur, qui détient
`event.read.detailed`, voit le tableau de bord complet.

### Parcours de l'Agent

Rôle d'organisation, valable sur **tous les évènements de l'organisation** : `org.read`, `org.events.list`, `scan.check-in`,
`badge.print`, `print.onsite.operate`, `scan.history.read`. Il choisit un évènement, scanne les QR, imprime les badges et tient
le poste d'impression sur place : liste `/event/[eventId]/print/onsite` puis poste `/event/[eventId]/print/[requestId]/onsite`.
Il ne voit **ni prix, ni lignes de devis, ni inscriptions nominatives** : les routes du poste (`…/print-requests/[requestId]/onsite/*`)
renvoient `404` pour toute commande qui n'est pas une impression sur place de cet évènement et de cette organisation.

### Boutons masqués

Les composants clients reçoivent `permissions: Permission[]` : « Exporter » (`registration.export`), « Inscription »
(`registration.create`), Approuver / Rejeter (`registration.approve`), « Marquer imprimé » et « Voir le badge » (`badge.print`),
modifier / supprimer / bloquer / ALL ACCESS (`registration.update`, `registration.delete`, `registration.block`, `registration.all_access`),
gestion des catégories (`event.categories.manage`), enregistrement des informations de l'évènement (`event.update`, en plus de
`event.settings.update` qui ouvre la page). « Accepter un devis » suit `print.quote.accept` (jamais pour le staff). La pièce d'identité
d'une inscription suit la règle de `/api/files` selon la classe de la clé.

### Union des rôles

Les permissions d'un utilisateur sont l'**union** de son rôle d'organisation et de son rôle d'évènement, plus ses ajustements
(socle, « Ordre de résolution »). Un Auditeur membre `PRINTER` d'un évènement voit donc les entrées de l'Observateur et de l'Imprimeur.

### Règles métier restées en code

La permission ne remplace pas les contrôles d'état : évènement archivé (écritures refusées sauf `allowArchived`), inscriptions
fermées, garde d'abonnement des écritures d'un membre (`MANAGE_ONGOING_EVENTS`), plafond d'organisation, dernier propriétaire,
statut de la commande d'impression. Les écritures faites par le staff plateforme sont journalisées avec `staffActor=true`.

### Limites connues

- Pas de permission de lecture de la page « Paramètres » de l'évènement : l'accès exige `event.settings.update` (la modification
  des informations exige en plus `event.update`).
- Le téléversement des images de l'évènement passe par `/api/org/[orgId]/upload` (`org.upload`) : un porteur de `event.update`
  sans `org.upload` voit les champs mais l'envoi d'image est refusé par le serveur.
- Un ajustement de permission posé au niveau d'un évènement n'entre pas dans le calcul de la page d'atterrissage ni de `/select`
  (le contexte ne connaît pas l'organisation de l'évènement) ; les gardes de page et de route, elles, le prennent en compte.

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
- Seuls les comptes `isStaff = 1` sont migrés, et la migration n'écrit jamais `isStaff`
  (invariant : `isStaff = platformRoleId != null`). Un compte avec `staffRole` renseigné mais
  `isStaff = 0` n'est **pas** promu : il est compté dans le rapport (« comptes incohérents ») pour
  qu'un humain tranche. Requête de contrôle à lancer avant la migration :
  `SELECT id, email FROM User WHERE isStaff = 0 AND staffRole IS NOT NULL`.
- La transaction de migration a un délai de 60 s (`timeout`) et 10 s d'attente (`maxWait`).
- Le déploiement n'entre pas dans le périmètre du chantier : migration sur la base de dev
  seulement.
