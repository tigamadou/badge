# Spec v4 — Chantier « rôles, permissions et documentation » : coordination (spec 36)

> **Statut** : validée — 2026-11-13
> **Type** : spec de coordination (découpage, contrats partagés, ordre de fusion)
> **Périmètre** : v4 — specs 37 à 40
> **Source** : `Todo.md` du 2026-11-12 + échanges avec l'utilisateur des 2026-11-12/13
> **Chantier** : `roles-permissions`, branche d'intégration `feat/roles-imprimeur-support`

## Les specs du chantier

| Spec | Sujet (item du Todo) | Où |
|---|---|---|
| 36 | Coordination (ce document) | — |
| 37 | [Rôles et permissions configurables](2026-11-13-37-v4-roles-et-permissions.md) (items 1 et 2) | socle + lots 2a, 2b, 2c |
| 38 | [Loader sur la planche en cours de génération](2026-11-13-38-v4-loader-generation-planches.md) (item 3) | lot 2a |
| 39 | [Quantité automatique des accessoires](2026-11-13-39-v4-quantite-accessoires-automatique.md) (item 4) | socle (règle serveur) + lot 2b |
| 40 | [Documentation contextuelle des pages](2026-11-13-40-v4-documentation-des-pages.md) (item 5) | socle (ancrages) + lot 4a |

## Plans

| Plan | Vague | Exécution |
|---|---|---|
| `plans/2026-11-13-1-socle-roles-docs.md` | 1 | dossier principal |
| `plans/2026-11-13-2a-plateforme-permissions.md` | 2 | `scripts/agent-stack.sh up 2a <branche>` |
| `plans/2026-11-13-2b-org-evenement-permissions.md` | 2 | `scripts/agent-stack.sh up 2b <branche>` |
| `plans/2026-11-13-2c-gestion-des-droits.md` | 2 | `scripts/agent-stack.sh up 2c <branche>` |
| `plans/2026-11-13-3-fusion-roles.md` | 3 | dossier principal |
| `plans/2026-11-13-4a-documentation-des-pages.md` | 4 | `scripts/agent-stack.sh up 4a <branche>` |
| `plans/2026-11-13-5-docs-fusion-et-pr.md` | 5 | dossier principal |

## Graphe d'exécution

```
  vague 1   socle (rôles : schéma, catalogue, résolution, gardes + compatibilité,
            migration, seed ; spec 39 : règle serveur ; spec 40 : ancrages)
                                   │
  vague 2      ┌───────────────────┼───────────────────┐   3 stacks
               2a plateforme       2b org/évènement     2c gestion des droits
               + spec 38           + spec 39            + participant
               └───────────────────┼───────────────────┘
  vague 3   fusion 2a → 2b → 2c, retrait de la compatibilité
                                   │
  vague 4   4a documentation des pages (1 stack) : outil, panneau, pages, consignes IA,
            pilote /org
                                   │
  vague 5   rédaction des 79 docs, relecture, vérification complète, PR
```

La documentation vient après les rôles parce qu'elle décrit les écrans **définitifs** et
leurs blocs de permission.

## Découpage détaillé

### Vague 1 — socle (fichiers modifiés)

Rôles et permissions (spec 37) :

- `prisma/schema.prisma` (modèle ci-dessus, `ActivityType`).
- `src/lib/permissions/**` (nouveau) : `catalog.ts`, `system-roles.ts`, `resolve.ts`,
  `labels.ts` (libellés FR par domaine), `index.ts`.
- `src/lib/auth-guards.ts`, `src/lib/auth-helpers.ts`, `src/lib/user-context.ts`,
  `src/types/auth.ts`, `src/lib/with-staff-auth.ts`, `src/lib/with-org-auth.ts`,
  `src/lib/with-event-auth.ts`, `src/lib/auth-participant.ts` (contrats + compatibilité).
- `src/lib/notifications/recipients.ts`, `types.ts`, `triggers.ts` (ciblage par permission).
- `src/lib/activity-labels.ts` (nouveaux types).
- `scripts/migrate-roles.ts` + cible `Makefile` `migrate-roles` ; `src/lib/seed-super-admin.ts` ;
  `prisma/seed/**` (rôles système, comptes démo dont Imprimeur et AGENT).
- `src/test/factories.ts`, `src/test-setup.ts`, `e2e/helpers/db.ts`, `e2e/helpers/auth.ts`
  (fabriques et helpers e2e par clé de rôle système, ex. `makeStaff("STAFF_PRINTER")`).
- `src/components/staff/print/OnsiteStation.tsx` et `src/components/staff/print/request-fetch.ts` :
  props `apiBase` et `backHref` (découplage de `/platform`), sans changement visible.
- **Logique d'impression partagée** par les routes de 2a et de 2b : migration des contrôles
  de rôle de `src/lib/print-requests/**` (`service.ts` `assertOwner` →
  `print.quote.accept`, `route.ts` `assertNotStaff` → `isStaffActor`, `lifecycle.ts`,
  `credit-view.ts`, `onsite-station-view.ts`, `quote.ts` : `staffRoleAtLeast` /
  `staffRole === …` → permissions passées en paramètre), `src/lib/print-sheets/layout-page-data.ts`,
  `src/components/event/print/guard.ts`.
- **Consommateurs transverses** : `src/components/activity/JournalEntryDetail.tsx` (libellé
  du rôle plateforme via `platformRole.name`), `src/lib/event-org.ts`,
  `src/lib/activity-log.ts`, `src/app/(marketing)/page.tsx`, `scripts/smoke-tests.ts`.
- `docs/v4/features/roles-permissions.md` (nouveau, squelette avec une section par lot).
- Tests de `src/lib/permissions/**` et des gardes à 100 %.

Quantité des accessoires (spec 39) : la règle serveur dans
`src/lib/print-requests/content.ts`.

Documentation des pages (spec 40), points d'ancrage seulement :
- `src/components/page-docs/PageDocButton.tsx` : composant client qui renvoie `null`,
  inséré dans l'en-tête de `StaffShell`, `OrgShell`, `EventShell` et du layout `/account`
  (à côté de la cloche) ;
- entrée de menu « Documentation » dans ces quatre espaces et pages d'attente
  (`EmptyState` « Bientôt disponible ») : `/platform/docs`, `/org/[orgId]/docs`,
  `/event/[eventId]/docs`, `/account/docs`. Le lot 4a remplace le composant et les pages.

### Vague 2 — lots (fichiers exclusifs)

| Lot | Fichiers exclusifs | Contenu |
|---|---|---|
| **2a Plateforme** | `src/app/api/platform/**` **sauf** `users/**`, `organizations/[orgId]/owners/**`, `roles/**` ; `src/app/platform/**` **sauf** `users/**`, `roles/**` ; `src/components/staff/**` **sauf** `UserCreationForm.tsx`, `print/OnsiteStation.tsx`, `print/request-fetch.ts` (socle) ; `src/app/api/files/**` ; `src/lib/platform-settings-tabs.ts` ; `src/components/platform/PlatformOrgShell.tsx` ; `docs/v4/features/impression-planches.md` ; `src/lib/print-requests/**` et `src/lib/print-sheets/**` **hors** fichiers migrés par le socle ; `src/middleware.ts` ; section « Plateforme » de la doc | Toutes les gardes plateforme en `permission` ; `StaffShell` filtré ; écarts UI/API corrigés ; `STAFF_PRINTER` opérationnel (menu Impression seul) ; `/api/files` par permission ; **spec 38** (loader des planches) |
| **2b Organisation et évènement** | `src/app/api/org/**` **sauf** `members/**`, `roles/**`, `events/[eventId]/members/**` ; `src/app/org/**` **sauf** `members/**`, `roles/**` ; `src/app/event/**` **sauf** `members/**` ; `src/components/admin/**` **sauf** `OrgMemberForm.tsx` ; `src/components/event/**` **sauf** `MemberInviteForm.tsx`, `MemberTable.tsx` ; `src/app/select/**` ; `src/lib/org-redirect.ts` ; section « Organisation et évènement » de la doc ; amendement de la spec 35 et de `docs/v4/features/impression-sur-place.md` | Gardes org/évènement en `permission` ; `EventShell` unique filtré ; pages gardées ; AGENT (routes et pages du poste sur place) ; **spec 39** (assistant de commande) |
| **2c Gestion des droits et participant** | `src/app/api/platform/roles/**`, `src/app/api/platform/users/**`, `src/app/api/platform/organizations/[orgId]/owners/**`, `src/app/platform/roles/**`, `src/app/platform/users/**` ; `src/app/api/org/[orgId]/roles/**`, `src/app/api/org/[orgId]/members/**`, `src/app/api/org/[orgId]/events/[eventId]/members/**`, `src/app/org/[orgId]/roles/**`, `src/app/org/[orgId]/members/**`, `src/app/event/[eventId]/members/**` ; `src/components/permissions/**` (nouveau : éditeur de rôle, éditeur de permissions d'utilisateur, sélecteur de rôle) ; `src/lib/role-management/**` (nouveau : service des rôles et ajustements) ; `UserCreationForm.tsx`, `src/components/platform/PlatformOrgMemberInviteForm.tsx`, `OrgMemberForm.tsx`, `MemberInviteForm.tsx`, `MemberTable.tsx` ; `src/app/api/account/**`, `src/app/account/**`, `src/app/api/events/[slug]/register/**` ; section « Gestion des droits » de la doc | Rôles personnalisés (plateforme, organisation), pages d'ajustement, sélecteurs de rôle par `roleId`, garde-fous, journal ; routes participant |

**En lecture seule pour les trois lots** : tous les fichiers du socle, ainsi que
`src/components/print/**` (aucun contrôle de rôle) et `src/components/staff/print/**` pour
2b (importés par les pages d'évènement). Besoin d'y toucher → s'arrêter et le signaler.

**Tests** : chaque lot possède les `__tests__` situés sous ses globs. Un test de
`src/lib/__tests__/` appartient au propriétaire du module qu'il teste (socle ou lot) ;
`src/test/**` appartient au socle. e2e : `e2e/platform/**` → 2a, sauf
`user-*.spec.ts` → 2c ; `e2e/org/**` et `e2e/event/**` → 2b, sauf les specs de membres →
2c ; `e2e/public/**` et les specs du compte participant → 2c ; `e2e/transverse/**` et
`e2e/helpers/**` → socle (adaptation aux helpers) puis fusion (passage complet).

**Entrées de menu** : le socle n'y touche pas. « Rôles » dans `StaffShell` est ajoutée par
2a (lien vers `/platform/roles`, permission `platform.roles.manage`) ; « Rôles » dans
`OrgShell` par 2b (lien vers `/org/[orgId]/roles`, `org.roles.manage`) ; les pages
appartiennent à 2c. Les liens « Permissions » depuis la fiche utilisateur et la liste des
membres sont dans des fichiers de 2c.

### Table de contrôle des interfaces partagées

| Paire | Fichier / interface | Producteur | Consommateur | Verdict |
|---|---|---|---|---|
| 2a / 2c | menu `StaffShell` → `/platform/roles` | 2a (lien) | 2c (page) | URL figée par la spec |
| 2b / 2c | menu `OrgShell` → `/org/[orgId]/roles` | 2b (lien) | 2c (page) | URL figée par la spec |
| 2a / 2b | `OnsiteStation` (`apiBase`, `backHref`) | socle | 2a (page plateforme), 2b (page AGENT) | dans le socle |
| 2a / 2b | `src/lib/print-requests/onsite-station.ts` | 2a (propriétaire, aucun changement prévu) | 2b (lecture seule) | 2b ne modifie pas ; besoin → remonte au socle |
| 2b / 2c | membres d'évènement : page `event/[eventId]/members` dans `EventShell` | 2b (menu) | 2c (page) | URL inchangée |
| tous | `can`, `loadPermissions`, wrappers | socle | tous | contrats figés |

### Vague 3 — fusion des lots de rôles

Ordre 2a → 2b → 2c sur la branche d'intégration, rebase avant chaque fusion. Puis :
suppression de la compatibilité `minRole`/`role` et des helpers dépréciés ; `grep` nul (hors
`scripts/migrate-roles.ts` et schéma) sur `minRole`, `staffRoleAtLeast`, `orgRoleAtLeast`,
`hasOrgRole`, `StaffRole`, `OrgRole`, `EventRole`, `"STAFF"` comme rôle effectif ; mise à
jour de `docs/v4/architecture.md` et de `CLAUDE.md` (liste des helpers de `auth.ts`) ;
`make lint && make typecheck && make test-coverage` et e2e complets.

### Vague 4 — lot 4a, documentation des pages (spec 40)

Une stack, partie de la branche d'intégration fusionnée (pages et permissions
définitives). Fichiers exclusifs : `scripts/page-docs/**`, `src/content/page-docs/**`,
`src/components/page-docs/**`, `src/app/platform/docs/**`, `src/app/org/[orgId]/docs/**`,
`src/app/event/[eventId]/docs/**`, `src/app/account/docs/**`, `Makefile` (cibles
`docs-check`, `docs-stamp`, ajout à `lint`), `package.json` / `yarn.lock`,
`CLAUDE.md` (section « Documentation des pages »), `AGENTS.md`,
`.claude/CLAUDE.md`, `.claude/skills/chantier/**`, `docs/v4/features/documentation-pages.md`.
Le lot livre l'outil, le panneau et les pages, et génère la doc d'**un espace pilote**
(`/org`, 14 pages) pour valider le format.

### Vague 5 — rédaction complète, fusion et PR

Rédaction des docs des 79 pages par des sous-agents de l'orchestrateur (un par espace,
selon la consigne de `CLAUDE.md`), `make docs-stamp`, relecture par l'orchestrateur
(cohérence avec les écrans, blocs `:::permission`, aucune donnée sensible), `make
docs-check` vert, vérification complète (`make lint && make typecheck && make
test-coverage`, e2e), PR vers `development`.

## Journal

- 2026-11-13 — L'utilisateur précise qu'un chantier peut porter plusieurs specs et lots :
  tout le `Todo.md` du 2026-11-12 entre dans ce chantier (specs 37 à 40).
- 2026-11-13 — Pas d'appel à l'API Anthropic : la doc des pages est écrite par les agents
  sur consigne ; plus de clé `ANTHROPIC_API_KEY` requise.
- 2026-11-13 — Relecture croisée des 7 plans (amendements en fin de chaque plan, qui
  priment) : garde « une parmi » (`permission` accepte une liste) dans le socle au lieu d'un
  helper de 2b ; `eventTargetOf` publié par le socle ; service de gestion des rôles dans
  `src/lib/role-management/**` (2c) ; fabriques `makeCustomRole` / `makeOverride` ;
  `PlatformOrgShell.tsx` et `impression-planches.md` à 2a ; `PlatformOrgMemberInviteForm.tsx`
  (dans `src/components/platform/`) à 2c ; propriété des tests de `src/lib/__tests__/` au
  propriétaire du module. Arbitrages du socle acceptés : repli sur l'enum quand `roleId` est
  nul et double écriture des enums pendant la transition (retirés avec les enums, hors
  chantier), `includeStaff` dans les notifications, contexte mémoïsé seulement pour les
  pages, `assertOwner` / `assertNotStaff` sur `isStaffActor`, correctifs mécaniques de
  typecheck du socle dans des fichiers de lots. Pertes de droits assumées : `STAFF_SUPPORT`
  perd planches, exports de badges et production ; l'Observateur perd planches et exports ;
  le PRINTER d'évènement ne reçoit plus l'ouverture/fermeture des inscriptions. Le nombre
  de pages documentées dépasse 79 (pages de rôles, de permissions et AGENT).
- 2026-11-13 — Revue finale du socle (1 Critical, 2 Important) corrigée avant la vague 2 :
  `memberPermissions(ctx, target)` publié comme contrat (droits côté organisateur d'un staff
  membre, sans son rôle plateforme) pour `assertOwner`, `organizerRoute` et les notifications ;
  rôle plateforme appliqué seulement si `isStaff` ; double écriture `roleId` / `platformRoleId`
  dans les 4 routes de changement de rôle (reprises par 2a et 2c) ; `migrate-roles` ne promeut
  plus de compte en staff. Amendements reportés en fin des plans 2a, 2b, 2c et 3.
- 2026-11-13 — Vague 3 (fusion) : fusions `--no-ff` des lots 2a (`fc73b38b`), 2b (`d93f9e47`) et 2c
  (`c2832b1b`), **sans rebase préalable** (choix de l'orchestrateur : les branches de lot contiennent
  des merges), sans conflit ; un import en double corrigé après fusion (`65a3edea`). Le lot 2c a
  modifié `resolve.ts` et `auth-guards.ts` (autorisé par les amendements N1/N2).
- 2026-11-13 — Arbitrage : le lot 2b a modifié `src/components/print/ProductCard.tsx` et
  `ProductConfigurator.tsx`, déclarés en lecture seule. Écart accepté par l'orchestrateur : il est
  nécessaire à la spec 39 révisée (quantité plafonnée, modifiable, alerte) et sans conflit avec les
  autres lots. La spec 39 révisée est intégrée dans 2a, 2b et 2c.
- 2026-11-13 — Retrait de la compatibilité (tâche 5) : `src/lib/auth-helpers.ts` supprimé ;
  `requireStaff`, `requireOrgRole`, `requireEventRole`, `requireEventPermission`,
  `getEffectiveEventRole`, options `minRole` / `role` et `effectiveRole`, champs de contexte
  `staffRole` / `role` retirés ; `withStaffAuth` exige désormais une `permission`. **Conservés**
  (amendements) : repli sur l'enum quand `roleId` est nul et double écriture `roleId` + enum dans
  les quatre routes de changement de rôle. Les occurrences restantes de `StaffRole` / `OrgRole` /
  `EventRole` sont des types Prisma de ces colonnes conservées (migration, seed, fabriques, double
  écriture, notifications) ; `"STAFF"` restant = côté `STAFF` d'un message d'impression, pas un rôle.
- 2026-11-13 — Cohérence et défauts jumeaux (tâches 6 et 7) : test `catalog-usage` (aucune clé
  orpheline, aucune clé non réservée jamais vérifiée) ; trois pages de liste de membres sans garde
  de page (`/platform/users`, `/org/[orgId]/members`, `/event/[eventId]/members`) désormais gardées par
  `users.read`, `org.members.read`, `event.members.manage` ; boucle `/platform` → `/` → `/platform`
  pour un compte staff dont le rôle n'a pas `platform.access` supprimée (`resolveHomeRedirect` et
  `/select`). Jumeaux déjà corrigés par les lots et vérifiés : paiement d'abonnement et commandes
  d'impression côté organisateur (`memberPermissions`), pages de supervision (journal, paiements),
  fiche de commande (paiements et crédit selon la permission), atterrissage d'évènement (repli
  Notifications), garde « dernier OWNER / SUPER_ADMIN » et protection des rôles supérieurs.
  Fuites d'état de test corrigées (droits d'abonnement laissés par les tests de paramètres,
  `fakeExporter` partagé) : tests uniquement.
- 2026-11-13 — Limite connue non corrigée (hors défaut de fusion) : `lib/org-redirect.ts` ignore
  les ajustements propres à une organisation pour un membre d'évènement (`orgId: ""`), d'où une
  boucle possible `/select` ↔ `/event/E` si un ajustement `REVOKE` d'organisation retire toutes ses
  permissions d'évènement.
- 2026-11-13 — Vérification finale (tâche 9) : e2e complet vert ; trois specs org (membres, paramètres, modèles) et `platform/user-new` (rattacher un client à une organisation exige `organizations.members.manage`, donc STAFF_ADMIN) alignées sur le catalogue. Échecs résiduels uniquement d'environnement (expirations, base injoignable sous charge). Contrôle visuel navigateur par rôle non réalisé.
