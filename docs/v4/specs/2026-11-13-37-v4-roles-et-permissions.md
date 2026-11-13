# Spec v4 — Rôles et permissions configurables (spec 37)

> **Statut** : implémentée — 2026-11-13 (PR ouverte, branche `feat/roles-imprimeur-support`), validée — 2026-11-13
> **Type** : refonte transverse (autorisation) + nouvelles fonctionnalités
> **Périmètre** : v4 — tous les espaces (plateforme, organisation, évènement, participant)
> **Source** : `Todo.md` du 2026-11-12 (items 1 et 2) + échanges avec l'utilisateur des 2026-11-12/13
> **Chantier** : `roles-permissions`, branche d'intégration `feat/roles-imprimeur-support`
> **Coordination** : [`2026-11-13-36-v4-chantier-roles-docs-coordination.md`](2026-11-13-36-v4-chantier-roles-docs-coordination.md)

## Contexte

Aujourd'hui les droits sont **écrits en dur** dans trois enums hiérarchiques :

- `StaffRole` : `SUPER_ADMIN > STAFF_ADMIN > STAFF_SUPPORT > STAFF_OBSERVER` (138 gardes
  `withStaffAuth({ minRole })`) ;
- `OrgRole` : `OWNER > MANAGER > AUDITOR` (11 gardes `withOrgAuth`, plus des `hasOrgRole`
  dans les pages) ;
- `EventRole` : `ADMIN > OPERATOR > { PRINTER, VIEWER }` (37 fichiers `withEventAuth`) ; seul ce
  niveau a déjà des permissions atomiques (`EventPermission`, 17 clés, dans
  `src/lib/auth-helpers.ts`).

Personne ne peut ajouter un rôle ni retirer une permission précise à quelqu'un. De plus,
tout le staff, **Observateur compris**, a tous les droits en écriture sur les données des
clients (`allowStaff`, rôle effectif `STAFF`).

## Objectif

1. Un **catalogue exhaustif de permissions** atomiques, défini dans le code.
2. Des **rôles** = ensembles de permissions. Des **rôles système** non supprimables et
   **figés** ; des **rôles personnalisés** illimités, dont on coche les permissions.
3. Des **ajustements par utilisateur** (ajouter ou retirer une permission à une personne),
   sur une **page dédiée à l'édition des permissions de cet utilisateur**.
4. Deux nouveaux rôles système : **`STAFF_PRINTER`** (« Imprimeur », menu Impression
   uniquement) côté plateforme et **`AGENT`** côté organisation (scan des QR et impression
   des badges des commandes sur place).

## Décisions (validées par l'utilisateur)

1. **Rôles en base, catalogue de permissions dans le code** (approche 1, 2026-11-12). Pas de
   librairie tierce (CASL, Casbin), pas d'interrupteurs posés sur les enums.
2. **Quatre niveaux** : plateforme, organisation, évènement, participant.
3. **Rôles système non supprimables** (2026-11-12) et **figés** (2026-11-13, option a) :
   leurs permissions ne changent qu'avec le code. Pour un réglage différent, on duplique le
   rôle en rôle personnalisé, ou on ajuste l'utilisateur.
4. **Rôles personnalisés d'organisation propres à chaque organisation** (option A,
   2026-11-12) : l'OWNER crée les siens, en plus des rôles système communs.
5. **Le super admin** gère les rôles plateforme et les permissions de **tout le monde**
   (staff, owner, membre, participant). **L'OWNER** gère les permissions des membres de son
   organisation, **en ajout comme en retrait**, sur une page d'édition dédiée
   (2026-11-12).
6. **Rôles système conservés** : `SUPER_ADMIN`, `STAFF_ADMIN`, `STAFF_SUPPORT`,
   `STAFF_OBSERVER` ; `OWNER`, `MANAGER`, `AUDITOR` ; `ADMIN`, `OPERATOR`, `PRINTER`, `VIEWER`
   (2026-11-13 : on garde les trois rôles de lecture seule).
7. **Nouveaux rôles système** : `STAFF_PRINTER` (Imprimeur) et `AGENT` (organisation).
8. **`STAFF_SUPPORT` garde son nom** (pour rester dans le scope staff) et se recentre sur la
   **validation** (profils, inscriptions) ; la production d'impression passe à
   `STAFF_PRINTER` (2026-11-13).
9. **Les rôles plateforme portent aussi des permissions d'organisation et d'évènement**,
   valables sur toutes les organisations (2026-11-13) : l'Observateur devient réellement en
   lecture seule chez les clients.
10. **AGENT** : sur **tous les évènements de son organisation**, il scanne les QR et imprime
    les badges des commandes sur place, sans accès à la liste détaillée ni aux réglages. Il
    amende la décision 3 de la spec 35 (« c'est un opérateur de la plateforme qui imprime
    sur place ») : un AGENT de l'organisation peut aussi tenir le poste.

## Approches envisagées

| Approche | Résumé | Verdict |
|---|---|---|
| **1. Rôles en base, catalogue dans le code** | Constante TypeScript des permissions ; tables `Role`, `RolePermission`, `UserPermissionOverride` ; toutes les gardes deviennent des vérifications de permission. | **Retenue.** Couvre rôles personnalisés et ajustements ; le code reste la seule source des clés qu'il vérifie. |
| 2. Garder les enums + interrupteurs en base | Table de permissions par valeur d'enum. | Écartée : pas de rôles personnalisés. |
| 3. Librairie (CASL, Casbin) | DSL de règles. | Écartée : dépendance et DSL pour un besoin couvert par trois tables. |

## Modèle

### Catalogue (code)

- Fichier : `src/lib/permissions/catalog.ts`. Chaque permission :
  `{ key, scope, domain, label, description, reserved? }`.
- `scope` ∈ `PLATFORM | ORG | EVENT | PARTICIPANT` : le niveau où la permission s'évalue.
- `label` et `description` en français (affichés dans l'éditeur de rôles).
- `reserved: true` : permission de **gestion des droits** ; elle n'existe que dans les rôles
  système qui la portent (`SUPER_ADMIN`, `OWNER`), ne peut être ni cochée dans un rôle
  personnalisé ni accordée par ajustement. Ce sont `platform.roles.manage`,
  `users.permissions.manage`, `org.roles.manage`, `org.members.permissions.manage`.
- Type `Permission` = union des clés (dérivée du catalogue, `as const`).
- Les permissions des **rôles système** vivent **dans le code**
  (`src/lib/permissions/system-roles.ts`), pas en base : un rôle figé n'a aucune ligne
  `RolePermission`. Une nouvelle permission ajoutée au code est attribuée aux rôles système
  dans le même changement.

### Qui peut porter quoi

| Rôle de niveau | Peut contenir des permissions de niveau |
|---|---|
| PLATFORM | PLATFORM, ORG, EVENT (appliquées à **toutes** les organisations et tous les évènements) |
| ORG | ORG, EVENT (appliquées à **tous les évènements** de l'organisation) |
| EVENT | EVENT |
| PARTICIPANT | PARTICIPANT |

### Schéma (Prisma)

```prisma
enum RoleScope { PLATFORM ORG EVENT PARTICIPANT }
enum PermissionEffect { GRANT REVOKE }

model Role {
  id          String    @id @default(cuid())
  scope       RoleScope
  systemKey   String?   @unique   // "SUPER_ADMIN", "OWNER", "AGENT"… ; null = personnalisé
  name        String               // libellé affiché (FR)
  description String?   @db.Text
  orgId       String?              // rôle personnalisé ORG ou EVENT d'une organisation ; null sinon
  archived    Boolean   @default(false)
  archivedAt  DateTime?
  createdById String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  permissions RolePermission[]
  // relations inverses : users (platformRole), orgMemberships, eventMemberships
  @@index([orgId, scope])
}

model RolePermission {
  roleId     String
  permission String              // clé du catalogue, validée par le code
  role       Role   @relation(fields: [roleId], references: [id], onDelete: Cascade)
  @@id([roleId, permission])
}

model UserPermissionOverride {
  id          String           @id @default(cuid())
  userId      String
  orgId       String?          // null = niveau plateforme (super admin) ; sinon organisation
  permission  String
  effect      PermissionEffect
  createdById String?
  createdAt   DateTime         @default(now())
  @@unique([userId, orgId, permission])
  @@index([orgId])
}
```

- `User.platformRoleId String?` (FK `Role`, scope PLATFORM) remplace `User.staffRole`.
  `User.isStaff` est **conservé** et tenu à jour (`isStaff = platformRoleId != null`) : le
  middleware Edge et le JWT le lisent.
- `OrgMembership.roleId` (scope ORG) remplace `role OrgRole` ; `EventMembership.roleId`
  (scope EVENT) remplace `role EventRole`.
- Rôle **participant** : un seul rôle système `PARTICIPANT`, **implicite** pour tout compte
  (aucune colonne).
- `@@unique([userId, orgId, permission])` : MySQL accepte plusieurs `NULL` ; l'unicité au
  niveau plateforme est garantie par le code (upsert dans une transaction).
- Relations et suppressions : `Role.orgId` et `UserPermissionOverride.orgId` →
  `Organization`, `onDelete: Cascade` (la suppression définitive d'une organisation emporte
  ses rôles et ajustements) ; `UserPermissionOverride.userId` → `User`, `Cascade` ;
  `User.platformRoleId`, `OrgMembership.roleId`, `EventMembership.roleId` → `Role`,
  `onDelete: SetNull` (un rôle n'est jamais supprimé hors cascade d'organisation ;
  l'archivage d'un rôle attribué est refusé par le code).
- **Nullabilité transitoire** : `platformRoleId` et les `roleId` sont **nullables** dans ce
  chantier (le `db push` doit passer sur des données existantes avant `migrate-roles`) ;
  le code traite `null` comme « aucun rôle ». Les colonnes d'enum (`staffRole`,
  `OrgMembership.role`, `EventMembership.role`) deviennent **optionnelles** ; le code ne
  les lit ni ne les écrit plus après le socle. Le passage à NOT NULL des `roleId` se fera
  avec la suppression des enums (changement ultérieur).
- Nom d'un rôle personnalisé unique par `(orgId, scope)` parmi les rôles non archivés
  (contrôle applicatif, 409 `ROLE_NAME_TAKEN`).
- **Migration en deux temps** (le projet utilise `db push`, sans migrations) : ce chantier
  **ajoute** les nouvelles colonnes et tables et **garde** les colonnes d'enum
  (`staffRole`, `OrgMembership.role`, `EventMembership.role`) **inutilisées**. Le script
  idempotent `scripts/migrate-roles.ts` (cible `make migrate-roles`) crée les rôles système
  et remplit `platformRoleId` / `roleId` depuis les enums. Les colonnes d'enum seront
  supprimées par un changement ultérieur, après passage du script en production (hors
  chantier).
- Nouveaux `ActivityType` : `ROLE_CREATED`, `ROLE_UPDATED`, `ROLE_ARCHIVED`,
  `ROLE_RESTORED`, `USER_PERMISSIONS_CHANGED`.

### Résolution des permissions effectives

Fichier : `src/lib/permissions/resolve.ts`, fonctions pures sur un `UserContext` enrichi.

```ts
export type PermissionTarget =
  | { kind: "platform" }
  | { kind: "org"; orgId: string }
  | { kind: "event"; eventId: string; orgId: string }
  | { kind: "participant" };

export function effectivePermissions(ctx: UserContext, target: PermissionTarget): Set<Permission>;
export function hasPermission(ctx: UserContext, permission: Permission, target: PermissionTarget): boolean;
```

(`can` est déjà pris par `src/lib/subscription-rights.ts` : ne pas réutiliser ce nom.)

**Règle de cible** : une permission s'évalue toujours sur la cible de **la ressource
touchée**. Une route plateforme qui agit sur une ressource d'évènement (poste
d'impression sur place, fichier d'export de badges, commande d'impression) vérifie la clé
EVENT sur la cible `{ kind: "event", eventId, orgId }` de cette ressource ; les clés EVENT
du rôle plateforme s'y appliquent puisqu'elles valent pour tous les évènements. Exemple :
`/api/platform/print/requests/[id]/onsite/print` est gardée par
`withStaffAuth({ permission: "platform.access" })` puis
`requirePermission(userId, "print.onsite.operate", eventTargetOf(request))`.

Ordre, pour une cible donnée :

1. **Base** = union de :
   - les permissions du rôle plateforme (celles de niveau ≤ cible) ;
   - pour `org` et `event` : les permissions du rôle d'organisation de l'utilisateur dans
     cette organisation ;
   - pour `event` : les permissions du rôle de membre de cet évènement ;
   - pour `participant` : les permissions du rôle `PARTICIPANT`.
2. **Ajustements plateforme** (`orgId = null`) : `GRANT` ajoute, `REVOKE` retire.
3. **Ajustements d'organisation** (`orgId` de la cible, pour `org` et `event`) : idem.
4. À un même niveau, `REVOKE` l'emporte sur `GRANT` (une seule ligne par clé de toute façon).
5. Une clé dont le niveau ne correspond pas à la cible est ignorée.

**Changement de comportement assumé** : aujourd'hui le rôle d'organisation **remplace** le
rôle de membre d'évènement (un AUDITOR membre PRINTER n'est que VIEWER). Désormais on fait
l'**union** : il est VIEWER **et** PRINTER.

`loadUserContext` charge en une requête : rôle plateforme (+ permissions si personnalisé),
memberships avec leur rôle (+ permissions si personnalisé), ajustements. Le contexte est
mémoïsé **par requête** (`cache()` de React, comme `src/lib/org-access.ts`). Pas de
permissions dans le JWT : les changements s'appliquent à la requête suivante.

### Gardes (contrats du socle)

```ts
// src/lib/auth-guards.ts
export async function requirePermission(userId: string, permission: Permission, target: PermissionTarget): Promise<void>;
// AuthError codes ajoutés : "PERMISSION_DENIED" (403)

// Wrappers de routes : la permission remplace minRole/role.
withStaffAuth(handler, { permission: Permission });            // cible platform
withOrgAuth(permission: Permission, handler);                  // cible org
withEventAuth({ permission: Permission, allowArchived?, requireRegistrationOpen? }, handler); // cible event

// Contexte passé aux handlers d'évènement : `effectiveRole` (et sa valeur "STAFF")
// disparaît, remplacé par :
type EventAuthCtx = {
  session: Session; orgId: string; eventId: string; event: /* inchangé */;
  permissions: Set<Permission>;   // permissions effectives sur l'évènement
  isStaffActor: boolean;          // staff sans membership dans l'org ni l'évènement
                                  // (règles « jamais le staff », bandeau mode staff)
};

// Participant
export async function requireParticipantPermission(permission: Permission): Promise<SessionUser>;
// relit l'utilisateur en base : un compte archivé ou bloqué est refusé (401/403)

// UI (Server Components)
export async function loadPermissions(userId: string, target: PermissionTarget): Promise<Set<Permission>>;
```

- **Compatibilité temporaire** : le socle garde `minRole` / `role` dans les wrappers et les
  helpers (`requireStaff`, `requireOrgRole`, `requireEventRole`, `hasOrgRole`,
  `hasEventPermission`), réimplémentés au-dessus des rôles système, pour que l'application
  reste verte entre le socle et les lots. Les lots remplacent tous les usages dans leurs
  fichiers ; la **fusion** supprime cette compatibilité et vérifie qu'il ne reste aucun usage
  (`grep` nul sur `minRole`, `StaffRole`, `OrgRole`, `EventRole` hors script de migration).
- Les **règles métier qui ne sont pas des permissions restent en code** : dernier
  `SUPER_ADMIN`, dernier `OWNER`, pas d'auto-modification de son rôle ni de ses permissions,
  droits d'abonnement (`subscription-rights.ts`), évènement archivé (410), le staff ne
  crée/soumet/accepte jamais une commande d'impression côté client (`assertNotStaff`,
  `assertOwner`), slug réservé au staff, contournement de quota par le staff, exemption
  `MANAGE_ONGOING_EVENTS` pour le staff.
- « Dernier OWNER » = dernier membre titulaire du **rôle système** `OWNER`. « Dernier
  SUPER_ADMIN » = dernier titulaire du rôle système `SUPER_ADMIN`.

### Gestion des droits : qui peut quoi

| Action | Qui | Où |
|---|---|---|
| Créer, modifier, archiver un rôle **plateforme** personnalisé | titulaire de `platform.roles.manage` (SUPER_ADMIN) | `/platform/roles` |
| Voir les rôles système (tous niveaux) et leurs permissions | idem, en lecture | `/platform/roles` |
| Ajuster les permissions de **n'importe quel** utilisateur (niveau plateforme et chacune de ses organisations) | `users.permissions.manage` (SUPER_ADMIN) | `/platform/users/[userId]/permissions` |
| Créer, modifier, archiver un rôle **d'organisation ou d'évènement** personnalisé de son organisation | `org.roles.manage` (OWNER) | `/org/[orgId]/roles` |
| Inviter un membre, changer son rôle, le retirer | `org.members.manage` (OWNER ; staff SA AD) | liste des membres et page d'édition |
| Ajuster les permissions d'un membre de son organisation (ajout et retrait) | `org.members.permissions.manage` (OWNER) | `/org/[orgId]/members/[userId]/permissions` |

Attribuer un rôle (système ou personnalisé) à un membre est soumis à l'anti-escalade :
l'acteur doit détenir toutes les permissions de ce rôle. Pour les membres d'évènement, la
même règle s'applique avec `event.members.manage`.

Garde-fous :

- **Anti-escalade** : on ne peut cocher dans un rôle, ni accorder par ajustement, qu'une
  permission que l'on détient soi-même sur la cible. Le SUPER_ADMIN détient tout.
- Les permissions `reserved` ne sont jamais cochables ni ajustables.
- L'OWNER n'édite pas les permissions d'un **autre OWNER** (seul le SUPER_ADMIN le peut).
- Personne n'édite ses propres permissions ni son propre rôle.
- Un rôle personnalisé **attribué** ne peut pas être archivé (409 `ROLE_IN_USE`) ; un rôle
  système ne peut être ni archivé ni modifié (409 `SYSTEM_ROLE`).
- Toute création ou modification de rôle, tout changement d'ajustement est journalisé
  (`logActivity`, avant/après dans `details`).

## Catalogue initial et rôles système

Abréviations des rôles système :

- Plateforme : **SA** `SUPER_ADMIN`, **AD** `STAFF_ADMIN`, **SU** `STAFF_SUPPORT`,
  **PR** `STAFF_PRINTER` (Imprimeur), **OB** `STAFF_OBSERVER`.
- Organisation : **O** `OWNER`, **M** `MANAGER`, **A** `AUDITOR`, **G** `AGENT`.
- Évènement : **ead** `ADMIN`, **eop** `OPERATOR`, **epr** `PRINTER`, **evi** `VIEWER`.
- **PA** `PARTICIPANT`.

« tout staff » = SA AD SU PR OB. Le SUPER_ADMIN détient **toutes** les permissions.

### Niveau PLATFORM

| Clé | Rôles système | Description |
|---|---|---|
| `platform.access` | tout staff | Accéder à l'espace plateforme |
| `platform.roles.manage` *(reserved)* | SA | Gérer les rôles plateforme et voir tous les rôles système |
| `users.permissions.manage` *(reserved)* | SA | Ajuster les permissions de n'importe quel utilisateur |
| `organizations.read` | SA AD SU OB | Consulter les organisations, leurs membres, évènements et journal |
| `organizations.create` | SA AD | Créer une organisation |
| `organizations.update` | SA AD | Modifier les informations d'une organisation |
| `organizations.archive` | SA AD | Archiver ou restaurer une organisation |
| `organizations.delete` | SA | Supprimer définitivement une organisation |
| `organizations.members.manage` | SA AD | Inviter, changer le rôle, retirer un membre d'organisation |
| `subscriptions.update` | SA AD | Attribuer un plan et un statut d'abonnement |
| `plans.read` | SA AD SU OB | Consulter les plans |
| `plans.manage` | SA AD | Créer et modifier les plans |
| `payments.read` | SA AD SU OB | Consulter les paiements, télécharger les reçus |
| `users.read` | SA AD SU OB | Consulter les utilisateurs |
| `users.update` | SA AD | Modifier le nom d'un utilisateur *(corrige l'ouverture actuelle à OB)* |
| `users.create` | SA AD SU | Créer un compte client |
| `users.staff.create` | SA AD | Créer un compte staff |
| `users.staff.assign_role` | SA AD | Changer le rôle plateforme d'un compte |
| `users.staff.assign_top_role` | SA | Attribuer ou retirer `STAFF_ADMIN` / `SUPER_ADMIN` |
| `users.archive` | SA AD | Archiver ou restaurer un utilisateur |
| `users.password.reset` | SA AD SU | Envoyer un lien de réinitialisation |
| `profiles.read` | SA AD SU OB | Consulter les profils à valider (et leurs documents) |
| `profiles.review` | SA AD SU | Approuver ou rejeter un profil |
| `blocklist.read` | SA AD SU OB | Consulter e-mails et documents bloqués |
| `blocklist.manage` | SA AD SU | Bloquer ou débloquer un e-mail ou un document |
| `settings.read` | SA AD SU OB | Consulter les paramètres (secrets masqués) |
| `settings.update` | SA AD | Modifier SMTP et reCAPTCHA (hors secrets) |
| `settings.secrets.update` | SA | Écrire le mot de passe SMTP et la clé secrète reCAPTCHA |
| `settings.smtp.test` | SA AD | Envoyer un e-mail de test |
| `settings.subscription_rights.update` | SA AD | Modifier la matrice des droits d'abonnement |
| `settings.badge_template.update` | SA AD | Choisir le template de badge par défaut |
| `settings.onsite_print.update` | SA AD | Régler l'impression sur place |
| `rejection_reasons.read` | SA AD SU OB | Consulter les motifs de rejet |
| `rejection_reasons.manage` | SA AD | Gérer les motifs de rejet |
| `badge_templates.read` | SA AD SU OB | Consulter les templates de badge installés |
| `badge_templates.manage` | SA AD | Inspecter, installer, archiver un template |
| `email_jobs.read` | SA AD SU OB | Consulter les envois d'e-mails |
| `email_jobs.manage` | SA AD | Annuler ou relancer un envoi |
| `activity.read` | SA AD SU OB | Consulter le journal plateforme |
| `print.requests.read` | SA AD PR OB | Consulter les commandes d'impression |
| `print.requests.messages.send` | SA AD PR | Écrire dans le fil de messages d'une commande, joindre un fichier (la lecture du fil relève de `print.requests.read`) |
| `print.requests.reject` | SA AD PR | Rejeter une commande |
| `print.requests.advance` | SA AD PR | Passer une commande en production, prête, terminée (hors sur place) |
| `print.requests.onsite.complete` | SA AD | Clore une commande sur place (crédit ou supplément) |
| `print.requests.quote.edit` | SA AD | Modifier les lignes du devis |
| `print.requests.quote.send` | SA AD | Envoyer le devis |
| `print.requests.reopen` | SA AD | Rouvrir une commande pour révision |
| `print.requests.mark_paid` | SA AD | Marquer payée manuellement |
| `print.requests.credit.apply` | SA AD | Appliquer le crédit d'impression |
| `print.onsite.margin.update` | SA AD | Régler la marge d'une commande sur place |
| `print.catalog.read` | SA AD PR OB | Consulter le catalogue produits |
| `print.catalog.manage` | SA AD | Gérer produits, options, paliers, images |
| `print.layouts.read` | SA AD PR OB | Consulter les gabarits de planche |
| `print.layouts.manage` | SA AD | Gérer les gabarits |
| `print.sheets.read` | SA AD PR | Lister et télécharger les planches |
| `print.sheets.generate` | SA AD PR | Générer des planches |

Le menu `StaffShell` n'affiche que les entrées dont l'utilisateur détient la permission de
lecture. L'Imprimeur voit donc : tableau de bord, notifications et le groupe **Impression**
(Commandes, Planches, Gabarits, Catalogue).

### Niveau ORG

| Clé | Rôles système | Description |
|---|---|---|
| `org.read` | O M A G ; SA AD SU OB | Accéder à l'espace organisation |
| `org.update` | O ; SA AD | Modifier les informations de l'organisation (slug : staff seul) |
| `org.activity.read` | O M A ; SA AD SU OB | Consulter le journal de l'organisation |
| `org.members.read` | O M A ; SA AD SU OB | Voir les membres |
| `org.members.manage` | O ; SA AD | Inviter, changer le rôle, retirer un membre (dernier OWNER protégé) |
| `org.roles.manage` *(reserved)* | O | Gérer les rôles personnalisés de l'organisation |
| `org.members.permissions.manage` *(reserved)* | O | Ajuster les permissions d'un membre |
| `org.templates.read` | O M A ; SA AD SU OB | Voir les modèles de catégories |
| `org.templates.manage` | O M ; SA AD | Gérer les modèles de catégories |
| `org.badge_settings.update` | O M ; SA AD | Choisir le template de badge de l'organisation |
| `org.upload` | O M ; SA AD | Téléverser les fichiers de l'organisation (logo) |
| `org.events.list` | O M A G ; SA AD SU OB | Lister les évènements |
| `org.events.create` | O M ; SA AD | Créer un évènement (droit `CREATE_EVENT` et quota en plus) |
| `org.events.archive` | O M ; SA AD | Archiver ou restaurer un évènement |
| `billing.subscription.read` | O M ; SA AD SU OB | Consulter l'abonnement et les plans |
| `billing.subscription.pay` | O | Payer ou changer d'abonnement (jamais le staff) |
| `billing.payments.read` | O M ; SA AD SU OB | Consulter les paiements, télécharger les reçus |
| `print.quote.accept` | O | Accepter et payer un devis d'impression (jamais le staff) |

`event.archive` de l'actuel `EventPermission` est renommée `org.events.archive` (l'API
l'exigeait déjà au niveau organisation).

### Niveau EVENT

| Clé | Rôles évènement | Rôles org (tous évènements) | Staff (tous évènements) | Description |
|---|---|---|---|---|
| `event.read.aggregated` | ead eop evi | O M A | SA AD SU OB | Chiffres agrégés, sans données nominatives |
| `event.read.detailed` | ead eop | O M | SA AD SU OB | Inscriptions, catégories, pièces d'identité en détail |
| `event.update` | ead | O M | SA AD | Modifier l'évènement (dont images) |
| `event.registration_toggle` | ead | O M | SA AD | Ouvrir ou fermer les inscriptions |
| `event.settings.update` | ead | O M | SA AD | Contacts, template de badge, paramètres |
| `event.categories.manage` | ead | O M | SA AD | Gérer les catégories |
| `event.members.manage` | ead | O M | SA AD | Gérer les membres de l'évènement |
| `event.activity.read` | ead | O M | SA AD SU OB | Journal complet de l'évènement |
| `scan.history.read` | ead eop | O M G | SA AD | Voir son propre historique de scans |
| `registration.approve` | ead eop | O M | SA AD SU | Approuver ou rejeter une inscription |
| `registration.create` | ead | O M | SA AD | Créer une inscription manuellement |
| `registration.update` | ead | O M | SA AD | Modifier une inscription |
| `registration.delete` | ead | O M | SA AD | Supprimer une inscription |
| `registration.export` | ead | O M | SA AD | Exporter les inscriptions |
| `registration.block` | ead | O M | SA AD | Bloquer e-mail ou document, voir les doublons |
| `registration.all_access` | ead | O M | SA AD | Accorder l'accès à toutes les zones |
| `badge.print` | ead eop epr | O M G | SA AD PR | Prévisualiser, exporter, marquer imprimés les badges |
| `scan.check-in` | ead eop | O M G | SA AD | Scanner les QR, contrôler l'accès |
| `print.request` | ead | O M | SA AD SU OB *(lecture seule : écriture refusée au staff en code)* | Créer et suivre les commandes d'impression |
| `print.onsite.operate` | ead | O M G | SA AD PR | Tenir le poste d'impression sur place (recherche, scan, impression) |

### Niveau PARTICIPANT

| Clé | Rôle système | Description |
|---|---|---|
| `account.profile.update` | PA | Modifier son profil |
| `account.profile.upload` | PA | Téléverser sa photo et sa pièce d'identité |
| `registration.self.create` | PA | S'inscrire à un évènement |
| `registration.self.resubmit` | PA | Resoumettre une inscription rejetée |

Les lectures de ses propres données (profil, inscriptions, notifications) restent toujours
permises à un compte valide. Le SUPER_ADMIN peut retirer une permission participant par
ajustement (par exemple bloquer les inscriptions d'un compte).

### Fichiers sensibles (`/api/files`)

| Classe de fichier | Règle |
|---|---|
| `print-sheets/*` | `print.sheets.read` (platform) |
| `print-requests/…` | `print.requests.read` (platform) **ou** `print.request` (event) |
| `badge-exports/{eventId}/…` | `badge.print` (event) |
| `events/{id}/idDocuments/…` | `event.read.detailed` (event) |
| `profile/{uid}/documents/…` | propriétaire **ou** `profiles.read` (platform) |

### Notifications

`RecipientSpec` gagne une variante `{ permission: Permission; target: PermissionTarget }`
qui remplace `staffMinRole`, `orgRoles`, `eventRoles`. Chaque déclencheur cible les
titulaires d'une permission **équivalente à son destinataire actuel**, avec deux
ajustements : les notifications de commandes d'impression destinées aujourd'hui au staff
≥ `STAFF_SUPPORT` vont aux titulaires de `print.requests.messages.send` (donc l'Imprimeur,
plus le Support) ; celles destinées à l'ADMIN d'évènement vont aux titulaires de
`print.request`. La table exacte trigger → permission est dans le plan du socle.

## Interfaces

### Plateforme

- `/platform/roles` : trois onglets (Plateforme, Organisation, Évènement). Rôles système en
  lecture (pastille « Système », permissions cochées grisées) ; rôles plateforme
  personnalisés : créer, dupliquer un rôle système, modifier, archiver.
- **Éditeur de rôle** (partagé plateforme / organisation) : nom, description, cases à cocher
  groupées par domaine avec libellé et description ; permissions `reserved` absentes ;
  permissions non détenues par l'éditeur désactivées avec infobulle.
- `/platform/users/[userId]/permissions` : rôle plateforme (sélecteur, selon
  `users.staff.assign_role` / `assign_top_role`), puis pour chaque niveau (plateforme, puis
  chaque organisation dont il est membre) : la liste des permissions avec trois états —
  **hérité du rôle**, **ajouté**, **retiré** — et le résultat effectif. Lien depuis la fiche
  utilisateur.
- Les sélecteurs de rôle existants (création d'utilisateur, invitation de membre
  d'organisation côté plateforme) listent les rôles système et les rôles personnalisés
  applicables.

### Organisation

- `/org/[orgId]/roles` : rôles système (lecture) et rôles personnalisés de l'organisation,
  aux niveaux Organisation et Évènement ; même éditeur.
- `/org/[orgId]/members/[userId]/permissions` : rôle d'organisation et ajustements (niveau
  organisation, qui s'appliquent aussi à tous ses évènements). Lien depuis la liste des
  membres.
- `OrgShell` : menu filtré par permission ; entrée « Rôles » pour `org.roles.manage`.
- Sélecteurs de rôle (invitation et changement de rôle de membre d'organisation et
  d'évènement) : rôles système + rôles personnalisés de l'organisation.
- Le layout `/org`, le sélecteur d'espace `/select` et `resolveHomeRedirect` acceptent
  tout membre détenant `org.read` (plus de liste `[OWNER, MANAGER, AUDITOR]` en dur).

### Évènement

- **Un seul gabarit `EventShell`**, menu filtré par permission ; les gabarits
  `EventOperatorShell`, `EventPrinterShell`, `EventViewerShell` disparaissent. Page
  d'atterrissage = première entrée autorisée. Chaque page vérifie sa propre permission
  (redirection vers `/event/[eventId]` sinon) : fin des pages ouvertes par URL directe.
- Le tableau de bord s'adapte aux permissions (bloc « Mes scans » si `scan.check-in` sans
  `event.read.detailed`, etc.).
- **AGENT / poste sur place** : nouvelles routes
  `/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/onsite/{lookup,search,print}`
  et `GET …/onsite` (état et compteur), gardées par `print.onsite.operate`, qui
  réutilisent `src/lib/print-requests/onsite-station.ts`. Pages :
  `/event/[eventId]/print/onsite` (commandes sur place actives, **sans prix ni devis**) et
  `/event/[eventId]/print/[requestId]/onsite` (le poste, composant `OnsiteStation`
  réutilisé). La marge reste staff.

### Participant

- Les routes `/api/account/**` et `POST /api/events/[slug]/register` passent par
  `requireParticipantPermission`, qui relit le compte en base (un compte archivé ou bloqué
  est refusé immédiatement, ce qui corrige la session valide jusqu'à 30 jours).

## Non-objectifs

- Supprimer les colonnes d'enum (`staffRole`, `OrgMembership.role`, `EventMembership.role`) :
  changement ultérieur, après le script en production.
- Rôles personnalisés **participant** ; ajustements au niveau d'un **seul évènement**
  (les ajustements d'organisation couvrent tous ses évènements).
- Items 3, 4 et 5 du `Todo.md` (loader des planches, quantité automatique des accessoires,
  documentation par page) : chantiers séparés.
- Corriger `/api/upload` anonyme et la visibilité des notifications d'un espace perdu :
  relevés pendant l'inventaire, hors périmètre.

## Anti-objectifs

- Une permission vérifiée par le code mais absente du catalogue, ou l'inverse.
- Un bouton affiché sans la permission que le serveur exige (cas actuels relevés :
  archivage d'organisation, création d'organisation et d'utilisateur, plans, abonnement,
  test SMTP, menu Planches pour l'Observateur).
- Une régression de droits pour un utilisateur existant, hors changements assumés
  (Observateur en lecture seule chez les clients ; `STAFF_SUPPORT` sans la production
  d'impression ; union rôle d'organisation + rôle d'évènement ; `users.update` réservé à
  AD+).

## Organisation du travail

Voir la spec de coordination du chantier :
[`2026-11-13-36-v4-chantier-roles-docs-coordination.md`](2026-11-13-36-v4-chantier-roles-docs-coordination.md)
(socle, lots, fichiers exclusifs, ordre de fusion).

## Ce qui reste au constructeur

- Noms exacts des composants et découpage interne des pages.
- La table trigger → permission des notifications (règle : équivalence avec l'actuel, plus
  les deux ajustements ci-dessus).
- Le libellé et la description française de chaque permission.

## Points à relire (non tranchés)

- **Ajustement GRANT plateforme sur un compte non staff.** `effectivePermissions` n'applique le
  rôle plateforme que si `isStaff` (invariant `isStaff = platformRoleId != null`), mais un
  ajustement de portée plateforme (`orgId = null`, GRANT) s'applique aussi à un compte non staff :
  seul le rôle plateforme est conditionné à `isStaff`. Seul un détenteur de
  `users.permissions.manage` qui détient lui-même la permission peut créer un tel ajustement
  (anti-escalade). Le code n'a pas été modifié ; à trancher : refuser l'ajustement plateforme
  sur un compte non staff, ou l'assumer.

## Journal

- 2026-11-12 — Approche 1 retenue ; rôles personnalisés d'organisation par organisation
  (A) ; AGENT ajouté ; OWNER édite les permissions de ses membres sur une page dédiée.
- 2026-11-13 — Staff porteur de permissions org/évènement (Observateur en lecture seule) ;
  `STAFF_SUPPORT` conservé et recentré, `STAFF_PRINTER` créé ; rôles système figés.
- 2026-11-13 — Inventaire des gardes par trois agents : ~190 routes, 56 pages/composants,
  131 fichiers de tests unitaires et 58 specs e2e concernés.
- 2026-11-13 — Relecture « constructeur » : arbitrages de l'agent — règle de cible
  (clé EVENT évaluée sur l'évènement de la ressource, y compris depuis une route
  plateforme) ; `EventAuthCtx` expose `permissions` et `isStaffActor` ; `hasPermission`
  au lieu de `can` ; `roleId` nullables et colonnes d'enum optionnelles pendant la
  transition ; cascades sur suppression d'organisation ; changement de rôle d'un membre
  sous `org.members.manage` ; logique d'impression partagée et consommateurs transverses
  remontés dans le socle ; propriété des tests par lot.
