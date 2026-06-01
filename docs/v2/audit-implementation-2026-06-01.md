# Audit d'implementation v2 — 2026-06-01

> Audit comparatif **prévu (specs + plans) vs implémenté (code)** sur la branche `feat/v2-implementation`.
> Méthode : 9 agents en parallèle (un par feature/domaine), lecture seule, format de rapport uniforme.
> Sources : `docs/v2/features/`, `docs/v2/specs/`, `docs/v2/plans/`, `src/`, `prisma/schema.prisma`.

---

## 1. Synthèse exécutive

### 1.1 Score global par feature

| Feature | Statut global | Couverture | Risques majeurs |
|---|---|---|---|
| **multi-tenancy-rbac** | ⚠ Partiel | 87 % | MANAGER bloqué sur 5+ routes ; cache `x-user-context` absent ; invariant `archived ⇒ inviteToken=NULL` non vérifié ; `getEffectiveEventRoles` signature divergente |
| **espace-staff** | ⚠ Partiel | 82 % | Secrets SMTP/reCAPTCHA modifiables par tout STAFF_ADMIN ; `ORG_DELETED` non loggé (type absent) ; endpoints `/staff/organizations/[orgId]/owners` absents ; bouton "Entrer dans l'organisation" absent |
| **espace-organisation** | ⚠ Partiel | 80 % | MANAGER/AUDITOR bloqués par le layout `/admin/[orgId]` ; routes mutantes OWNER-only contraires à la spec ; `GET /api/admin/[orgId]` tronqué (pas de legalName/adresse/contact) |
| **espace-evenement** | ⚠ Partiel | 82 % | OPERATOR ne peut pas approuver/rejeter/imprimer ; shells PRINTER & VIEWER absents ; page `/overview` absente ; guards de pages côté serveur manquants pour PRINTER/VIEWER |
| **inscription-publique** | ⚠ Partiel (superseded v2-11) | 45 % (v2-05) / 80 % (v2-11) | Tracker v2-05 surévalué : 7 tasks `[x]` pour artefacts supprimés par v2-11 ; logo fallback `Event→Org` UI publique absent ; reCAPTCHA non câblé sur `/e/[slug]/register` |
| **notifications-email** | ✓ Conforme | 90 % | `orgWebsite` absent du footer ; `{{role}}` non injecté dans `USER_INVITATION` ; tracker Task 7 `[x]` pour `sendEditLinkEmail` supprimée |
| **deploiement-initial** | ✓ Conforme | 90 % | `prisma/seed.ts` working tree non committé casserait le smoke test ; `docker/compose.dev.env` utilise encore clés v1 ; `--accept-data-loss` silencieux au boot |
| **comptes-participants (v2-11)** | ✓ Conforme | 92 % | `BlockedEmail`/`BlockedDocument` non vérifiés à register/profil (modèle event-scoped) ; `src/lib/edit-token.ts` dead code ; critères post-impl C1–C9 non cochés |
| **templates-badges (v2-12)** | ✓ Conforme | 96 % | CI absente (décision explicite) ; previews PNG = placeholder 1×1 ; `BadgeTemplatePicker` mal localisé ; entrée v2-11/v2-12 manquante dans `docs/v2/README.md` |

**Verdict** : implémentation v2 substantiellement complète à **~86 % en moyenne**. Aucune feature « non implémentée ». Les écarts se concentrent sur 4 axes :

1. **RBAC fonctionnel** — OWNER systématiquement requis là où MANAGER devrait suffire (espace-organisation, espace-evenement).
2. **Couverture des rôles secondaires** — PRINTER, VIEWER, OPERATOR sous-implémentés en API et dépourvus de pages dédiées.
3. **Trackers de plans surévalués** — plans v2-05, v2-06 (Task 7), v2-11 (post-impl), v2-02 (Task 15) déclarent des tasks `[x]` qui ne correspondent pas à l'état réel.
4. **Suppressions v2-11 incomplètes** — `edit-token.ts`, `SubmissionSnapshot` (placeholder UI), `BlockedEmail`/`BlockedDocument` event-scoped désormais inadaptés.

### 1.2 Carte des risques par sévérité

#### Sécurité / RBAC — Critique
- **[espace-staff]** `PATCH /api/staff/settings` accepte `smtpPassword` et `recaptchaSecretKey` pour tout `STAFF_ADMIN` (spec demande `SUPER_ADMIN`). Pas de ré-authentification pour le toggle "Afficher" les secrets.
- **[espace-evenement]** OPERATOR bloqué sur `approve`/`reject`/`print` (`minRole: "ADMIN"`) — divergence avec la matrice `EVENT_PERMISSION_ROLES` documentée dans `auth-helpers.ts`.
- **[espace-organisation]** Layout `/admin/[orgId]` vérifie `hasOrgRole(ctx, orgId, "OWNER")` — MANAGER et AUDITOR sont redirigés vers `/select`, espace complet OWNER-only de facto.
- **[multi-tenancy-rbac]** `DELETE /api/admin/[orgId]/members/[userId]:93` reconstruit le garde-fou last-owner sans filtrer `user.archived: false` (incohérence avec `assertNotLastOwner`).

#### Conformité fonctionnelle — Élevé
- **[espace-organisation]** `POST /events`, `POST /events/[id]/archive|restore`, `POST/PATCH/DELETE /templates` refusent MANAGER (spec autorise OWNER **ou** MANAGER).
- **[espace-evenement]** Page `/overview` (vue VIEWER agrégée, sans coordonnées) absente. VIEWER n'a aucune vue dédiée.
- **[espace-staff]** Endpoints `/staff/organizations/[orgId]/owners` (GET/POST/DELETE) absents. Bouton "Entrer dans l'organisation" absent de la page détail org.
- **[inscription-publique]** Tracker plan v2-05 déclare `[x]` 7 tâches (9, 11, 12, 13, 14, 16, 17) dont les artefacts ont été supprimés par v2-11 sans mise à jour des statuts.

#### Audit / observabilité — Moyen
- **[espace-staff]** `ActivityType.ORG_DELETED` absent du schéma → DELETE org silencieux dans l'audit.
- **[comptes-participants]** `BlockedEmail` et `BlockedDocument` (event-scoped dans le schéma) ne peuvent pas être vérifiés à la création de compte / mise à jour du profil comme la spec l'exige — incohérence modèle / spec non tranchée.

#### Hygiène code — Faible
- `src/lib/edit-token.ts` + son test orphelin depuis v2-11 (Task 18 cochée à tort).
- `src/components/event/RegistrationHistory.tsx` placeholder vide depuis la suppression de `SubmissionSnapshot`.
- `prisma/seed.ts` modifié dans le working tree (seed démo 10 orgs/30 events/200 participants) — non committé. Si committé en l'état, casse `make smoke-tests` après `make prod-db-reset-v2`.
- `docker/compose.dev.env` utilise encore `SMTP_HOST=mailpit` (clé v1) au lieu de `PLATFORM_SMTP_*`.

### 1.3 Plan d'action recommandé (par ordre de priorité)

1. **Critique — sécuriser les secrets plateforme** : ajouter une garde `SUPER_ADMIN` sur les champs `smtpPassword`/`recaptchaSecretKey` dans `PATCH /api/staff/settings` ; ajouter ré-auth pour afficher les secrets.
2. **Critique — corriger les rôles MANAGER** : repasser 5+ routes OWNER → MANAGER dans `/api/admin/[orgId]/events/*` et `/api/admin/[orgId]/templates/*` ; passer le layout `/admin/[orgId]` à AUDITOR ; étendre `/select` aux trois rôles.
3. **Élevé — implémenter `/overview` VIEWER** et les shells PRINTER/VIEWER (`EventPrinterShell` + branche VIEWER dans `layout.tsx`).
4. **Élevé — clarifier OPERATOR approve/reject/print** : soit aligner le code sur la matrice (autoriser OPERATOR), soit mettre à jour la spec et la matrice de permissions.
5. **Élevé — endpoints owners staff** : créer `GET/POST/DELETE /api/staff/organizations/[orgId]/owners` + bouton "Entrer dans l'organisation".
6. **Élevé — audit `ORG_DELETED`** : ajouter le type à `ActivityType`, instrumenter le DELETE org.
7. **Moyen — nettoyer les trackers** :
   - v2-05 : repasser à `[-]` les tasks supersédées par v2-11.
   - v2-06 Task 7 : repasser à `[-]` (`sendEditLinkEmail` supprimée).
   - v2-02 Task 15 : repasser à `[x]` (`sendUserInvitation` implémentée).
   - v2-11 : cocher les critères post-impl C1–C9 ou les déclasser explicitement.
8. **Moyen — résoudre `BlockedEmail`/`BlockedDocument`** : décider entre (a) ajouter un scope plateforme aux modèles pour la vérification register/profil, (b) maintenir la vérification event-only et mettre à jour la spec.
9. **Moyen — nettoyer dead code v2-11** : supprimer `src/lib/edit-token.ts` + test, retirer ou marquer `RegistrationHistory.tsx` comme placeholder.
10. **Faible — `prisma/seed.ts` working tree** : décider du sort du seed démo (cible Makefile séparée `db-seed-demo`, branchement `NODE_ENV`, ou revert).
11. **Faible — `docker/compose.dev.env`** : aligner sur `PLATFORM_SMTP_*`.

---

## 2. Rapports détaillés par feature

### 2.1 multi-tenancy-rbac

**Sources** : `docs/v2/features/multi-tenancy-rbac.md`, `docs/v2/plans/2026-05-28-v2-01-multi-tenancy-rbac.md`, `docs/v2/specs/2026-05-28-v2-master-design.md`.

#### Résumé exécutif
- **Statut global** : Partiel
- **Couverture** : 87 %
- **Risques majeurs** :
  - MANAGER verrouillé hors de plusieurs routes qu'il devrait pouvoir appeler (create event, archive/restore event, CategoryTemplate CRUD, list org members) — violation directe de la matrice de permissions.
  - Le middleware ne contrôle ni l'appartenance org ni la cohérence `event.orgId=path.orgId` (délégué aux guards) — conforme à la défense en profondeur mais diverge des étapes 4-5 du pseudo-code de la spec.
  - Cache `x-user-context` prévu (step 6 du middleware) non implémenté.
  - `logStaffActionOnClient` mentionné dans la spec absent du code.
  - DELETE `/members` reconstruit manuellement le garde-fou last-owner sans filtre `archived`.

#### Routes API divergentes
| Route | Code | Statut | Note |
|---|---|---|---|
| `POST /api/admin/[orgId]/events` | `events/route.ts:69` | ⚠ | `withOrgAuth("OWNER")` — spec autorise MANAGER |
| `POST /events/[eventId]/archive\|restore` | `archive/route.ts:16`, `restore/route.ts:16` | ⚠ | `requireOrgRole("OWNER")` — spec autorise MANAGER |
| `GET /api/admin/[orgId]/members` | `members/route.ts:9` | ⚠ | `withOrgAuth("OWNER")` — spec autorise OWNER/MANAGER/AUDITOR en lecture |
| `POST/PATCH/DELETE /templates` | `templates/route.ts:23`, `templates/[id]/route.ts:26` | ⚠ | OWNER-only — spec autorise MANAGER |

#### Helpers
- `getEffectiveEventRoles` (pluriel, retour `{ staff: boolean; roles: EventRole[] }`) prévu par la spec → code expose `getEffectiveEventRole` (singulier, retourne `EffectiveEventRole`). Divergence d'interface.
- `loadUserContext` déplacé dans `user-context.ts` (spec : `auth.ts`).
- `logStaffActionOnClient` absent — `logActivity` fait le travail implicitement via auto-calcul `staffActor`.

#### Modèle Prisma
- Tous les modèles spec (Organization, OrgMembership, Event, EventMembership, enums, ActivityType, ActivityLog) présents avec champs alignés.
- `Organization` enrichi (legalName, adresse, taxId, website, logo, contacts, quotas).
- `OrgSettings` correctement supprimé (fusion dans `Organization`).
- `Registration` v2-11 (snapshot inline, FK userId obligatoire, plus de editToken/SubmissionSnapshot).

#### Garde-fous vérifiés
- `assertNotLastOwner` / `assertNotLastSuperAdmin` conformes (`auth-guards.ts:121,146`).
- `staffActor=true` auto-dérivé pour staff agissant sur données client.
- SMTP / reCAPTCHA secrets jamais exposés dans les réponses API.
- Hiérarchies SUPER_ADMIN > STAFF_ADMIN > STAFF_SUPPORT > STAFF_OBSERVER et OWNER > MANAGER > AUDITOR correctement implémentées.
- Héritage OWNER/MANAGER → ADMIN event et AUDITOR → VIEWER event corrects.

#### Fidélité du tracker
Plan déclare 12 tâches `[x]` (0-12). Globalement fidèle. La Task 10 ("identification imports v1 cassés") est cosmétique. Le plan v2-01 lui-même est fidèle à son périmètre, mais les divergences de niveau de rôle relèvent des plans v2-02 à v2-05.

---

### 2.2 espace-staff

**Sources** : `docs/v2/features/espace-staff.md`, `docs/v2/plans/2026-05-28-v2-02-espace-staff.md`.

#### Résumé exécutif
- **Statut global** : Partiel
- **Couverture** : 82 %
- **Risques majeurs** :
  - `smtpPassword` et `recaptchaSecretKey` modifiables par tout `STAFF_ADMIN` (spec demande SUPER_ADMIN).
  - `ORG_DELETED` absent de `ActivityType` ; le hard delete d'une org ne trace rien.
  - Aucun endpoint `/staff/organizations/[orgId]/owners` implémenté.
  - Bouton "Entrer dans l'organisation" absent.
  - `PlatformSettingsForm` ne distingue pas STAFF_ADMIN / SUPER_ADMIN côté UI (toggle secrets sans ré-auth).

#### Pages
Toutes présentes sauf `/staff/organizations/[orgId]/edit` (absente). Tabs détail org non implémentées (page unique). Colonne "dernier login" absente sur `/staff/users` car `User.lastLoginAt` n'existe pas dans le schéma.

#### Routes API
- ✓ Liste/création/archive/restore orgs ; users CRUD ; settings GET/PATCH ; test SMTP ; activity ; reset-password staff.
- ✗ `GET/POST/DELETE /api/staff/organizations/[orgId]/owners` (3 routes manquantes).
- ⚠ `PATCH /api/staff/settings` : minRole=STAFF_ADMIN pour tout le PATCH, aucune garde sur les champs sensibles.
- ⚠ `DELETE org` retourne 204 mais ne loggue rien (`ORG_DELETED` absent du schéma).

#### Garde-fous
- ✓ STAFF_ADMIN ne peut créer STAFF_ADMIN/SUPER_ADMIN ; SUPER_ADMIN seul promeut STAFF_ADMIN/SUPER_ADMIN ; jamais modification de son propre rôle ; HTTP 409 LAST_SUPER_ADMIN ; hard delete org = SUPER_ADMIN-only.
- ✗ Secrets accessibles via UI sans ré-authentification.
- ⚠ STAFF_OBSERVER : API protégée mais boutons "Nouvelle organisation" / "Nouvel utilisateur" restent visibles côté UI.

#### Notifications
- ✓ `sendUserInvitation`, `sendPasswordResetEmail`, `sendSmtpTest` implémentées dans `mail.ts:543,598,643`.
- ⚠ Tracker Task 15 reste `[~]` ("En ATTENTE Plan 6") alors que Plan 6 est livré.

#### Fidélité du tracker
- Tasks 0–14 et 16 `[x]` cohérentes avec le code.
- **Task 15 à repasser `[x]`** : les vraies implémentations sont en place.
- Notes plan documentent correctement la décision reCAPTCHA plateforme (vs note "org-only" obsolète).

---

### 2.3 espace-organisation

**Sources** : `docs/v2/features/espace-organisation.md`, `docs/v2/plans/2026-05-28-v2-03-espace-organisation.md`.

#### Résumé exécutif
- **Statut global** : Partiel
- **Couverture** : 80 %
- **Risques majeurs** :
  1. MANAGER et AUDITOR complètement bloqués de `/admin/[orgId]/*` (layout vérifie OWNER minimum) — contraire à la spec.
  2. Plusieurs routes mutantes (création event, archive event, restore event, templates PATCH/DELETE) refusent MANAGER alors que la spec l'autorise.
  3. `GET /api/admin/[orgId]` ne retourne pas les champs administratifs (legalName, adresse, taxId, logo) — uniquement quotas et compteurs.

#### Pages
| Page | Statut | Note |
|---|---|---|
| `/admin/[orgId]` (dashboard) | ✓ | KPI + 5 events + 10 activités + alerte quota |
| `/admin/[orgId]/settings` | ✓ | 4 sections présentes ; section Quotas en lecture seule absente |
| `/admin/[orgId]/settings/badge` (v2-12) | ✓ | MANAGER-accessible |
| `/admin/[orgId]/members` | ⚠ | Colonne "dernier login" absente du rendu (API la retourne) |
| `/admin/[orgId]/templates` | ⚠ | Boutons Éditer/Supprimer pas adaptés par rôle |
| `/admin/[orgId]/events` | ⚠ | Filtres archived/registrationOpen absents de l'UI ; pas de boutons Archive/Restaurer |
| `/admin/[orgId]/events/new` | ✓ | Wizard 3 étapes |
| `/admin/[orgId]/activity` | ⚠ | Filtres et pagination cursor absents |
| `/select` | ⚠ | Filtre `role: "OWNER"` exclut MANAGER/AUDITOR |

#### Routes API divergentes
| Route | Code | Statut |
|---|---|---|
| `GET /api/admin/[orgId]` | `route.ts:7` | ⚠ `select` Prisma incomplet (legalName, adresse, etc. omis) |
| `GET /api/admin/[orgId]/members` | `members/route.ts:9` | ✗ OWNER-only — spec : OWNER/MANAGER/AUDITOR |
| `GET /api/admin/[orgId]/activity` | `activity/route.ts:6` | ✗ OWNER-only — spec : OWNER/MANAGER/AUDITOR |
| `POST /api/admin/[orgId]/events` | `events/route.ts:69` | ✗ OWNER-only — spec : OWNER ou MANAGER |
| `POST /events/[id]/archive\|restore` | `archive/route.ts:16` | ✗ OWNER-only — spec : OWNER ou MANAGER |
| `POST/PATCH/DELETE /templates` | `templates/...:23,36,65` | ✗ OWNER-only — spec : OWNER ou MANAGER |
| `POST /api/admin/[orgId]/archive` & `/restore` | absent | ✗ Routes org-level non créées |

#### Garde-fous
- ✓ `assertNotLastOwner`, slug staff-only, rejet SMTP/reCAPTCHA legacy, quota events, slug event unique, scope check event∈org, MANAGER bloqué inviter membres org (correct).
- ✗ Validation upload logo (5 Mo / JPEG/PNG/WebP) absente — champ accepte URL libre.
- ⚠ DELETE member last-owner check inline ne filtre pas `user.archived`.

#### Helpers
Tous présents (`withOrgAuth`, `requireOrgRole`, `hasOrgRole`, `assertNotLastOwner`, `resolveHomeRedirect`, `uniqueEventSlug`, `logActivity`, composants `OrgShell`/`OrgSelector`/`StaffBanner`/`EventCreationWizard`).

#### Notifications
- ✓ Invitation nouveau user (inviteToken 24h) via `sendUserInvitation`.
- ✗ Email d'information user existant ajouté à une org : non envoyé (`if (isNewUser)` filtre).

#### Fidélité du tracker
- Task 17 déclare "9 routes API admin + 7 pages admin livrées, conformes à la spec" — optimiste vu les divergences MANAGER.
- Task 18 `[~]` (en attente Plan 6) fidèle, mais `sendUserInvitation` est désormais livrée — Task 18 à repasser `[x]`.
- Task 14 (select) ne mentionne pas le filtre OWNER restrictif.

---

### 2.4 espace-evenement

**Sources** : `docs/v2/features/espace-evenement.md`, `docs/v2/plans/2026-05-28-v2-04-espace-evenement.md`.

#### Résumé exécutif
- **Statut global** : Partiel (majoritairement implémenté, divergences sur PRINTER/VIEWER/OPERATOR)
- **Couverture** : 82 %
- **Risques majeurs** :
  1. Rôles PRINTER et VIEWER : pas de shell dédié, pas de page `/overview`, pas d'enforcement côté pages serveur.
  2. OPERATOR ne peut pas approuver/rejeter/imprimer en API (`minRole: "ADMIN"`) — divergence intentionnelle (testée) mais contraire à la spec et au critère #2.
  3. Routes `/badges` dédiées (GET liste, GET/POST/PATCH par badgeId) absentes — la liste passe par `/registrations?status=APPROVED`.

#### Pages
| Page | Statut |
|---|---|
| Dashboard event ADMIN | ✓ (KPI + Mes scans OPERATOR). Variante PRINTER/VIEWER absente, mini-chart 30j absent |
| `/registrations` | ✓ (sans guard côté page) |
| `/registrations/overview` | ✗ Absent |
| `/registrations/new`, `/registrations/[regId]` | ✓ |
| `/badges`, `/badges/[id]`, `/badges/print` | ✓ |
| `/categories`, `/members`, `/settings`, `/settings/badge`, `/blocked-emails`, `/blocked-documents` | ✓ |
| `/activity` | ✓ (guard côté page PRINTER/VIEWER → 403) |
| `/scan` | ⚠ Pas de guard côté page |

#### Routes API divergentes
- ✗ `GET /registrations/overview` absente.
- ✗ `POST /registrations/[regId]/approve` `minRole: "ADMIN"` — spec autorise OPERATOR.
- ✗ `POST /registrations/[regId]/reject` idem.
- ✗ `POST /registrations/[regId]/print` `minRole: "ADMIN"` — spec autorise OPERATOR/PRINTER.
- ✗ Routes badges dédiées (`GET /badges`, `POST /badges/[id]/print`, `PATCH /badges/[id]/all-access`) absentes.
- ⚠ `POST /scan` (spec) implémenté en `POST /scan/verify` + `POST /registrations/[regId]/checkin` (doublon fonctionnel).

#### Garde-fous
- ✓ Quota inscriptions (HTTP 429 public, bypass+audit admin), REJECTED exclus, détection doublons, soft delete event, slug staff-only, suppression catégorie avec inscriptions → 409, scope check event∈org, staffActor auto-calculé, pas de champs SMTP dans EventSettings, editToken supprimé (v2-11), QR `https://[host]/verify/[badgeId]`.
- ⚠ `RegistrationHistory.tsx` : composant existe mais affiche tableau vide (`SubmissionSnapshot` supprimé v2-11) — placeholder non documenté.
- ⚠ `src/lib/edit-token.ts` orphelin (concept supprimé v2-11).

#### Notifications
Toutes implémentées : `sendStatusNotification` (approved/rejected), `sendBadgePrintedNotification` (unitaire + batch), `sendUserInvitation` (membres event). `sendEditLinkEmail` supprimée volontairement (v2-11).

#### Fidélité du tracker
- Tasks 0–20 et 22 `[x]` cohérents.
- Divergence `minRole: "ADMIN"` sur approve/reject/print non documentée comme décision explicite — test "OPERATOR cannot approve (403)" capture l'écart côté code, mais ni la spec ni la matrice de permissions ne reflètent ce choix.
- Absence shells PRINTER/VIEWER et page `/overview` non signalées.
- `edit-token.ts` orphelin non noté.

---

### 2.5 inscription-publique (supersédé partiellement par v2-11)

**Sources** : `docs/v2/features/inscription-publique.md`, `docs/v2/plans/2026-05-28-v2-05-inscription-publique.md`.

#### Résumé exécutif
- **Statut global** : Implémenté avec supersession partielle par v2-11.
- **Couverture (spec v2-05 originale)** : ~45 %
- **Couverture (scope v2-11 actuel)** : ~80 %
- **Risques majeurs** :
  1. Le modèle `Registration.userId` est non-nullable (schema.prisma:248) — inscription anonyme structurellement impossible.
  2. `SubmissionSnapshot` (modèle prévu par v2-05) absent du schéma.
  3. Routes `POST /api/public/events/[slug]/registrations`, `GET/POST /api/public/edit-registration/[token]`, `resend` absentes.
  4. Logo cascade `Event.logo → Organization.logo → Platform` (note 2026-05-31) non implémentée dans `PublicEventLayout`.

#### Pages
- ✓ `/e/[slug]`, `/e/[slug]/success`, `/e/[slug]/register` (v2-11), `/verify/[badgeId]`, `/account/registrations/[id]`.
- ✗ `/edit-registration/[token]` et `/edit-registration/expired` — supprimées par v2-11.

#### Routes API
- ✓ `GET /api/public/events/[slug]`, `GET /api/public/verify/[badgeId]`, `POST /api/upload?context=event:[slug]`, `POST /api/events/[slug]/register` (v2-11), `POST /api/account/registrations/[id]/resubmit` (v2-11).
- ✗ `POST /api/public/events/[slug]/registrations` (anonyme) — directory inexistant.
- ✗ `/api/public/edit-registration/[token]` GET/POST + resend — absents (cohérent avec v2-11).

#### Garde-fous
- ✓ Validation image 5 Mo / JPEG/PNG/WebP/PDF, PDF interdit pour photo, blocklists email/document, quota org (PENDING+APPROVED), snapshot inline, rate-limit 10/min/IP, HMAC upload tokens TTL 1h, anti-traversal, email confirmation, email resoumission.
- ⚠ reCAPTCHA : `getPlatformPublicRecaptcha()` existe mais n'est pas appelée dans `/e/[slug]/register`. Le `RegisterEventForm` ne gère pas de widget reCAPTCHA.
- ⚠ Logo fallback : `loadPublicEventBySlug` ne sélectionne pas `organization.logo` ; `PublicEventLayout` n'affiche que `event.logo`.
- ⚠ Lien `website` org dans footer absent.

#### Helpers
Présents : `upload-token.ts`, `rate-limit.ts`, `recaptcha.ts`, `public-event.ts`, `validators/registration.ts`, `event-quota.ts`. Orphelin : `edit-token.ts` (v2-11).

#### Fidélité du tracker
**Tracker surévalué** : 19/19 tâches `[x]` mais :
- Tâches 9, 11, 12 (routes anonymes + edit-registration) : artefacts inexistants.
- Tâches 13, 14, 16 (`PublicRegistrationForm`, `EditRegistrationForm`, pages `/edit-registration/*`) : absents.
- Tâche 17 (`public-e2e.test.ts`) : fichier absent.
- Note en bas du plan documente les décisions de suppression, mais les statuts des tâches individuelles n'ont pas été mis à jour à `[-]`.

---

### 2.6 notifications-email

**Sources** : `docs/v2/features/notifications-email.md`, `docs/v2/plans/2026-05-28-v2-06-notifications-email.md`.

#### Résumé exécutif
- **Statut global** : Conforme (plan 6 = 100 %, ajouts v2-11 intégrés)
- **Couverture** : 90 %
- **Risques majeurs** :
  1. `orgWebsite` absent de `ResolvedTransport` et des templates — critère d'acceptation 4 partial.
  2. `{{role}}` non injecté dans `USER_INVITATION` — paramètre reçu mais ignoré, contrairement aux libellés français prévus.
  3. `sendEditLinkEmail` supprimé (correct v2-11) mais Task 7 du tracker reste `[x]` au lieu de `[-]`.

#### Décision SMTP plateforme uniquement (2026-05-31)
- ✓ `getPlatformSmtp()` sans cascade (`mail.ts:85`).
- ✓ Branding cascade Event → Org pour `contactEmail`/`contactPhone` (`settings.ts:69`).
- ✓ Logo cascade `Event.logo → Organization.logo` (`mail.ts:54`).
- ✓ Pas de champs SMTP sur `EventSettings` ni `Organization` (schéma).
- ✓ `OrgSettings` supprimé, contacts fusionnés dans `Organization`.

#### Templates email
| Email | Code | Statut |
|---|---|---|
| `sendRegistrationConfirmation` | `mail.ts:249` | ✓ |
| `sendStatusNotification` (APPROVED/REJECTED) | `mail.ts:287` | ✓ Lien rejet pointe `/account/registrations/[id]` (v2-11) |
| `sendBadgePrintedNotification` | `mail.ts:369` | ✓ |
| `sendRegistrationResubmitted` | `mail.ts:499` | ✓ (ajout v2-11) |
| `sendUserInvitation` | `mail.ts:543` | ⚠ `{{role}}` non injecté dans le body |
| `sendPasswordResetEmail` | `mail.ts:598` | ✓ |
| `sendSmtpTest` | `mail.ts:643` | ✓ (plateforme uniquement, propage les erreurs) |
| `sendAccountVerifyEmail` | `mail.ts:426` | ✓ (v2-11) |
| `sendAccountPasswordReset` | `mail.ts:462` | ✓ (v2-11) |
| `sendEditLinkEmail` | absent | ✓ (supprimé v2-11) |

#### Manques
- `orgWebsite` absent de `ResolvedTransport` et `buildEmail` ; `Organization.website` existe dans le schéma mais n'est ni sélectionné ni affiché en footer.
- `{{role}}` reçu (`options.role`) mais non utilisé dans le body de `sendUserInvitation`.
- `STAFF_NEW_ORG_MEMBER_INVITED` non implémenté (optionnel selon spec).

#### Fidélité du tracker
- Tasks 0–6, 8–12 `[x]` correctes.
- **Task 7 `[x]`** pour `sendEditLinkEmail` qui a été supprimée — devrait être `[-]` avec note v2-11.
- Tests : libellé "uses raw platform from when no context" du plan vs "labels with event title even when event has no settings" du code (Task 3 — renommage cohérent avec la décision branding).

---

### 2.7 deploiement-initial

**Sources** : `docs/v2/features/deploiement-initial.md`, `docs/v2/plans/2026-05-28-v2-07-deploiement-initial.md`.

#### Résumé exécutif
- **Statut global** : Livré (outillage opérationnel)
- **Couverture** : 90 %
- **Risques majeurs** :
  1. Le plan v2-07 (Step 1.1, Steps 7.x) utilise encore `SEED_STAFF_EMAIL`/`SEED_STAFF_PASSWORD` alors que la livraison réelle utilise `SEED_SUPER_ADMIN_*` — incohérence terminologique non purgée dans le corps du plan.
  2. `prisma/seed.ts` modifié dans le working tree (non committé) — seed de démo (10 orgs, 30 events, 200 participants) qui cassera le smoke test "0 org / 0 event" si committé tel quel.
  3. `docker/compose.dev.env` référence encore `SMTP_HOST=mailpit` (clé v1), pas de `PLATFORM_SMTP_*`.

#### Fichiers infra
- ✓ `Dockerfile` (multi-stage Node 22-alpine + Prisma + entrypoint), `Dockerfile.dev` (hot reload), `docker-compose.yml` (prod : caddy/app/pma/mysql + volumes + healthcheck), `docker-compose.dev.yml` (app/mysql/pma/mailpit, ports 3000/8080/8025).
- ✓ `Caddyfile` (badge.bj + pma.badge.bj, TLS Let's Encrypt).
- ✓ `.env.production.example` versionné (variables v2 : PLATFORM_SMTP_*, SEED_SUPER_ADMIN_*, UPLOAD_TOKEN_SECRET, reCAPTCHA).
- ⚠ `docker/compose.dev.env` stale (clés v1).
- ✓ `Makefile` : cibles dev (dev/dev-build/dev-down/db-*), prod (prod/prod-build/prod-seed/prod-db-push), backup-prod, migrate-uploads-clear, prod-db-reset-v2, smoke-tests, rollback-prod, upload/deploy/download-*, E2E (test-e2e, test-e2e-ui, validate-badge-templates).
- ✓ `scripts/smoke-tests.ts` (8 checks : DB, PlatformSettings, staff, 0 org, 0 event, /login, /staff, /api/auth/providers) + tests.
- ✓ `docs/v2/installation.md` (578 lignes, 9 sections, noms `SEED_SUPER_ADMIN_*` alignés).

#### Garde-fous
- ✓ Confirmations interactives `reset-v2` (prod-db-reset-v2) et `rollback` (rollback-prod).
- ✓ `.env.production` jamais committé, `backups/` exclus.
- ✓ bcrypt 12 rounds dans seed.
- ✓ Seed minimal en prod (HEAD) : PlatformSettings + SUPER_ADMIN.
- ⚠ `docker-entrypoint.sh` : `prisma db push --accept-data-loss` à chaque démarrage prod (silencieusement destructif si schéma régresse).

#### Modèle Prisma
- Tous les modèles v2 présents. Migrations Prisma formelles absentes — schéma géré par `prisma db push` (choix délibéré du plan, à revisiter avant stabilisation).
- `SubmissionSnapshot` listé dans la spec mais absent du schéma (v2-11 intègre directement dans `Registration.snapshot*`).

#### Fidélité du tracker
- Tasks 0–7 `[x]` cohérents avec HEAD.
- Notes Task 4 documentent correctement le renommage `SEED_STAFF_*` → `SEED_SUPER_ADMIN_*`.
- Smoke test "0 org / 0 event" valide en HEAD mais cassé par la modif working tree de `seed.ts`.

---

### 2.8 comptes-participants (v2-11)

**Sources** : `docs/v2/specs/2026-05-31-v2-11-comptes-participants.md`, `docs/v2/plans/2026-05-31-v2-11-comptes-participants.md`.

#### Résumé exécutif
- **Statut global** : Essentiellement complet
- **Couverture** : 92 %
- **Risques majeurs** :
  1. `BlockedEmail` NON vérifiée à la création de compte (`POST /api/auth/register`) — spec §1.3 et critère C8 non satisfaits.
  2. `BlockedDocument` NON vérifiée à `PUT /api/account/profile` — même manque.
  3. `src/lib/edit-token.ts` + test non supprimés (dead code).
  4. Critères post-implémentation C1–C9 + Final restent `[ ]` dans le plan.

#### Pages
Toutes présentes : `/register`, `/verify-email/[token]`, `/forgot-password`, `/reset-password/[token]`, `/account`, `/account/profile`, `/account/profile/complete`, `/account/registrations/[id]`, `/e/[slug]/register` (auth), `/e/[slug]/success`. Pages `/edit-registration/*` correctement absentes.

#### Routes API
- ✓ `POST /api/auth/register` (reCAPTCHA, bcrypt 12, hash token, audit).
- ✓ `POST /api/auth/verify-email` (anti-énum, idempotent).
- ✓ `POST /api/auth/forgot-password` (toujours 200).
- ✓ `POST /api/auth/reset-password`.
- ✓ `GET/PUT /api/account/profile` (sanitize).
- ✓ `GET /api/account/registrations`, `GET /api/account/registrations/[id]` (403 si autre user).
- ✓ `POST /api/account/registrations/[id]/resubmit` (re-snapshot, 409 si pas REJECTED).
- ✓ `POST /api/events/[slug]/register` (auth, profil complet, snapshot, unique check, quota, BlockedEmail/Document vérifiés ici).
- ✓ `POST /api/account/upload` (photo/document).

#### Garde-fous
- ✓ `emailVerifiedAt` requis pour login, `blocked` bloque login, `setup-password` pose `emailVerifiedAt`, bcrypt 12, profil complet requis, `@@unique([userId, eventId])`, lien rejet vers `/account/registrations/[id]`, quota org.
- ✗ `BlockedEmail` à register (spec §1.3) — note : modèle event-scoped rend la vérif globale impossible sans restructuration.
- ✗ `BlockedDocument` à update profil — même problème.

#### Modèle Prisma
- ✓ Tous les champs User v2-11 (emailVerifiedAt, emailVerifyToken/Expiry, passwordResetToken/Expiry, firstName/lastName/structure/photo/idDocument*, participantProfileCompletedAt, blocked/blockedReason).
- ✓ `Registration.userId` (Restrict), `snapshot*` (8 champs), `@@unique([userId, eventId])`.
- ✓ `SubmissionSnapshot`, `editToken/Expiry`, `EDIT_LINK_SENT` supprimés.
- ✓ Nouveaux `ActivityType USER_*` (7 types).
- ⚠ Index `@@index([eventId, status])` scindé en deux index séparés.

#### Notifications
Toutes implémentées : `sendAccountVerifyEmail`, `sendAccountPasswordReset`, `sendRegistrationConfirmation` (snapshot v2-11), `sendRegistrationResubmitted`, `sendStatusNotification` REJECTED → `/account/registrations/[id]`. `sendEditLinkEmail` supprimée.

#### Fidélité du tracker
- Tasks 0–20 toutes `[x]` 2026-06-01 — cohérent pour la majorité.
- **Incohérence** : critères post-impl C1–C9 + Final restent `[ ]` malgré l'annonce "intégralement terminé".
- **Incohérence Task 17** (seed) : `prisma/seed.ts` modifié non committé.
- **Incohérence Task 18** (suppression legacy) : `edit-token.ts` + test toujours présents.

---

### 2.9 templates-badges (v2-12)

**Sources** : `docs/v2/specs/2026-05-31-v2-12-templates-badges.md`, `docs/v2/plans/2026-05-31-v2-12-templates-badges.md`.

#### Résumé exécutif
- **Statut global** : Implémentation complète, conforme à la spec ADR
- **Couverture** : 96 %
- **Risques majeurs** :
  1. Intégration CI absente (décision explicite user, non un oubli).
  2. Sous-specs v2-11/v2-12 absentes du tableau "Sous-spécifications fonctionnelles" de `docs/v2/README.md`.
  3. Previews PNG = placeholder 1×1 (décision délibérée, designer à livrer).
  4. `BadgeTemplatePicker` placé dans `src/components/admin/` au lieu de `src/app/admin/.../settings/badge/` (composant partagé entre 3 pages — choix défendable).

#### Pages
- ✓ `/admin/[orgId]/events/[eventId]/settings/badge` (Server Component, cascade complète).
- ✓ `/admin/[orgId]/settings/badge` (MANAGER+).
- ✓ `/staff/settings/badge` (STAFF_ADMIN+).
- ⚠ `BadgeTemplatePicker.tsx` co-localisation différente du plan (partagé, défendable).

#### Routes API
- ✓ `GET /api/admin/.../badges/[badgeId]` (PDF stream, cascade, fallback orphelin, header `x-template-id`).
- ✓ `PATCH /api/admin/.../events/[id]/settings/badge` (Zod nullable, audit `EVENT_SETTINGS_UPDATED`).
- ✓ `PATCH /api/admin/[orgId]/settings/badge` (MANAGER, audit `ORG_UPDATED`).
- ✓ `PATCH /api/staff/settings/badge` (STAFF_ADMIN, refuse null, audit `PLATFORM_SETTINGS_UPDATED`).

#### Garde-fous
- ✓ Cascade Event > Org > Platform non-null garantie.
- ✓ Fallback `default-v1` si id orphelin du registry.
- ✓ `PlatformSettings.badgeTemplateId @default("default-v1")`.
- ✓ Seed initialise `"default-v1"`.
- ✓ Pas de `"use client"` dans les `template.tsx`.
- ✓ `Font.register` Montserrat centralisé via Google Fonts.
- ✓ `anonymous` / `neutralBadge` respectés.
- ✓ Validation `templateId` côté route via `getTemplate()`.

#### Helpers
- ✓ `resolveBadgeTemplateId(event, org, platform)` (`settings.ts:121`) — 2ème param `Organization` (adapté car `OrgSettings` supprimé).
- ✓ `getTemplate`, `listTemplates`, `DEFAULT_TEMPLATE_ID`, `buildTemplateContext`, `mm`, `fonts.ts`.

#### Modèle Prisma
- ✓ `Event.badgeTemplateId String?` (l.154).
- ✓ `Organization.badgeTemplateId String?` (l.105 — sur `Organization` car `OrgSettings` supprimé).
- ✓ `PlatformSettings.badgeTemplateId String @default("default-v1")` (l.328).

#### Fidélité du tracker
**Exact et complet**. Toutes les 18 tâches (0–17) `[x]` 2026-06-01. Divergences (OrgSettings, BadgeTemplatePicker, CI) toutes documentées dans la colonne "Notes".

---

## 3. Annexe — méthodologie

- **9 agents en parallèle** (`general-purpose`, modèle Sonnet), un par feature/domaine, lecture seule, briefs auto-suffisants (chemins absolus, format de rapport strict).
- **Sources de vérité** : code (`src/`, `prisma/schema.prisma`) ; spec (`docs/v2/features/`, `docs/v2/specs/`) ; plan (`docs/v2/plans/`, sections `## Progression`).
- **Convention statuts** : ✓ conforme | ⚠ divergent | ✗ manquant | ? incertain.
- **Hors périmètre** : exécution effective des tests (vérification statique seulement), audit visuel UI (pas de navigation navigateur), audit sécurité offensif.

### Prochaines étapes possibles
1. Démarrer un plan d'implémentation `docs/v2/plans/2026-06-XX-v2-14-audit-fixes.md` qui traite les points critiques et élevés de §1.3 dans l'ordre.
2. Lancer un audit complémentaire ciblé sur la suite de tests (`make test`) pour confirmer la couverture déclarée par les trackers.
3. Lancer un audit visuel (Playwright) pour confirmer les divergences UI (PRINTER/VIEWER, MANAGER sur `/admin/[orgId]`).
