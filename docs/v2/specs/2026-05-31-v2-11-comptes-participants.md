# Spec v2-11 — Comptes participants

> **Statut** : conception validée — 2026-05-31
> **Type** : refonte structurelle du flux d'inscription publique (v2-05 superseded en partie)
> **Périmètre** : v2 uniquement
> **Spec maîtresse** : [`docs/v2/specs/2026-05-28-v2-master-design.md`](2026-05-28-v2-master-design.md)
> **Specs liées** :
> - [v2-01 Multi-tenancy & RBAC](../features/multi-tenancy-rbac.md) — `User` est unifié (staff + participant), mise à jour à propager
> - [v2-05 Inscription publique scopée](../features/inscription-publique.md) — **partiellement superseded** : `/edit-registration/[token]` disparaît, formulaire devient compte-required à la soumission, `SubmissionSnapshot` est supprimé
> - [v2-06 Notifications email multi-tenant](../features/notifications-email.md) — nouveaux templates email (vérification, reset password, resoumission via compte)

## Contexte et objectifs

En v1 et dans le design v2 actuel, chaque inscription à un événement est un objet `Registration` indépendant : le participant remplit un formulaire avec toutes ses infos personnelles (nom, prénom, structure, photo, document d'identité) à chaque event. Pour modifier ses infos après rejet, un `editToken` à usage unique est envoyé par email, valide pour une seule session d'édition. `SubmissionSnapshot` historise chaque resoumission.

Cette mécanique a deux limites majeures qui apparaissent dès qu'on monte à plusieurs events par participant :

1. **Friction utilisateur** : un participant régulier (ex : un journaliste qui couvre 4 conférences par an) ré-upload sa photo et sa pièce d'identité à chaque fois. Aucune réutilisation des infos.
2. **Édition par token** : le `editToken` à usage unique est fragile (email perdu = inscription bloquée), inutilisable en libre-service par le participant, et accumule de la complexité (SubmissionSnapshot, expiration, hash).

Cette spec remplace ce paradigme par un **compte participant unifié et global** :

- Un seul compte par personne sur toute la plateforme, partagé entre toutes les organisations.
- Authentification email + mot de passe + vérification email (cohérent avec le `CredentialsProvider` NextAuth déjà en place pour le staff).
- Les infos personnelles (photo, document, structure) vivent sur le compte et sont **snapshotées** à chaque inscription pour audit et historique d'event.
- L'édition se fait via le profil utilisateur (page `/account/profile`), plus de token jetable.
- L'approbation reste **par event** (chaque org reste maître de ses participants, modèle v1 conservé).

## Décisions tranchées (synthèse ADR)

| Sujet | Décision | Pourquoi |
|---|---|---|
| Modèle de compte | `User` unifié (staff + org/event members + participants) | Une seule table d'identité plateforme. RBAC déjà en place gère l'accès aux espaces admin. Cohérent avec NextAuth `CredentialsProvider`. Moins de code à maintenir. |
| Portée du compte | Global, cross-organisations | Un participant utilise le même compte pour s'inscrire à n'importe quel event de n'importe quelle org. Coeur de la valeur ajoutée vs v1. |
| Authentification | Email + mot de passe + vérification email | Familier, robuste, indépendant de la délivrabilité SMTP au quotidien. `bcryptjs` 12 rounds (déjà en place). Min 6 caractères (règle projet). |
| Approbation des inscriptions | Par event (modèle v1 conservé) | Chaque org reste responsable de valider qui entre à ses events (sécurité, identification, quotas). Compte ≠ KYC global. |
| Stockage photo + ID | Sur le compte (`User`), snapshot inline à chaque `Registration` | Réutilisation transparente entre events. Audit préservé : la `Registration` voit toujours les infos au moment de l'inscription, même si le profil change ensuite. |
| Suppression `editToken` + `SubmissionSnapshot` | Oui, supprimés | L'édition passe par `/account/profile` et `/account/registrations/[id]`. Pas de token jetable, pas de table d'historique séparée (le snapshot inline suffit). |
| Flux d'inscription | Page `/e/[slug]` reste publique, login demandé à la soumission | Conversion : le lien public est partageable et indexable. Friction minimale (login uniquement à la soumission). |
| `BlockedEmail` / `BlockedDocument` | Conservés tels quels, vérifiés à la création de compte et à l'ajout de doc | Permet de bloquer un email avant qu'il ne crée un compte. Le `BlockedDocument` reste utile (un même doc d'identité peut tenter d'être réutilisé avec un autre email). |
| Migration v1 | Aucune (v2 reset complet — décision spec maîtresse v2 déjà actée) | Pas de mapping v1 `Registration.email` vers `User.email`. La prod v1 est repartie de zéro avec la v2. |
| Reprise des `Registration` existantes en v2 | N/A — pas encore implémenté, la spec v2-05 sera mise à jour en même temps | Le travail v2 est en cours, on bouge le modèle avant la première écriture en prod. |

---

## Section 1 — Évolutions du modèle Prisma

### 1.1 Modèle `User` (extensions)

Ajouts par rapport à la v2 actuelle (multi-tenancy-rbac.md) :

```prisma
model User {
  id              String   @id @default(cuid())
  email           String   @unique
  password        String                 // bcryptjs 12 rounds, min 6 chars
  name            String
  // ... champs RBAC déjà prévus (staffRole, etc.)

  // Vérification email
  emailVerifiedAt        DateTime?
  emailVerifyToken       String?  @unique
  emailVerifyTokenExpiry DateTime?

  // Reset password
  passwordResetToken     String?  @unique
  passwordResetExpiry    DateTime?

  // Profil participant — peut être vide pour un staff pur, rempli lors de la première inscription event
  firstName            String?
  lastName             String?
  structure            String?
  photo                String?      // path relatif dans uploads/
  idDocumentType       String?
  idDocumentNumber     String?
  idDocument           String?      // path relatif dans uploads/
  participantProfileCompletedAt DateTime?

  // Moderation
  blocked       Boolean  @default(false)
  blockedReason String?

  // Relations
  registrations Registration[]
  // ... orgMemberships, eventMemberships, activityLogs déjà prévus
}
```

Notes :

- Tous les champs profil participant sont **nullable** : un staff applicatif peut ne jamais remplir son profil participant. Le profil ne devient obligatoire qu'au moment de soumettre une `Registration`.
- `participantProfileCompletedAt` est un drapeau dérivé : posé quand `firstName` + `lastName` + `structure` + `photo` + `idDocumentType` + `idDocumentNumber` + `idDocument` sont tous non-null. Recalculé à chaque update de profil.
- `blocked` se substitue à un statut d'audit : un user bloqué ne peut plus se loguer ni soumettre d'inscription. Le staff peut débloquer.

### 1.2 Modèle `Registration` (refonte)

```prisma
model Registration {
  id              String   @id            // cuid (généré, plus l'id custom de v1)
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Restrict)
  eventId         String
  event           Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  categoryId      String
  category        Category @relation(fields: [categoryId], references: [id])

  status          RegistrationStatus @default(PENDING)
  badgePrinted    Boolean   @default(false)
  badgePrintedAt  DateTime?
  allAccessGranted Boolean  @default(false)

  // Snapshot des infos profil au moment de la soumission (re-snapshoté à chaque resubmit)
  snapshotFirstName        String
  snapshotLastName         String
  snapshotEmail            String
  snapshotStructure        String
  snapshotPhoto            String
  snapshotIdDocumentType   String
  snapshotIdDocumentNumber String
  snapshotIdDocument       String

  rejectionReason  String?
  rejectionDetails String?  @db.Text

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([userId, eventId])   // un participant ne peut s'inscrire qu'une fois à un event donné
  @@index([eventId, status])
}
```

Suppressions par rapport à la v1 / au design v2-05 actuel :

- `email`, `lastName`, `firstName`, `structure`, `photo`, `idDocumentType`, `idDocumentNumber`, `idDocument` : remplacés par les snapshots (mêmes noms préfixés `snapshot`) plus la référence `userId`.
- `editToken`, `editTokenExpiresAt` : supprimés (édition via compte).
- Modèle `SubmissionSnapshot` (table dédiée) : supprimé. Le snapshot inline + l'audit log existant suffisent pour l'historique. Si plus tard on veut un historique multi-versions par registration, on le réintroduira proprement (YAGNI).

### 1.3 `BlockedEmail` et `BlockedDocument` (inchangés)

Conservés tels quels. Vérifiés :

- À la création de compte (`POST /api/auth/register`) : si l'email est dans `BlockedEmail`, refuser.
- À la complétion / mise à jour du profil participant (`PUT /api/account/profile`) : si `idDocumentNumber` est dans `BlockedDocument`, refuser.

Pas de vérif sur `Registration` directement : si le doc passe au niveau profil, l'inscription est OK.

### 1.4 `ActivityType` (nouveaux types)

Ajouts à enum `ActivityType` :

- `USER_REGISTERED` (création de compte)
- `USER_EMAIL_VERIFIED`
- `USER_PASSWORD_RESET_REQUESTED`
- `USER_PASSWORD_RESET_COMPLETED`
- `USER_PROFILE_UPDATED`
- `USER_BLOCKED`
- `USER_UNBLOCKED`
- `REGISTRATION_RESUBMITTED` (déjà existant en v1, à conserver — pointe désormais sur l'action profil + resubmit côté compte)

---

## Section 2 — Flux utilisateur

### 2.1 Découverte et inscription à un event

1. Le participant arrive sur `/e/[slug]` (lien public, server component).
2. La page affiche : titre, date, lieu, logo, description, catégories disponibles, bouton « S'inscrire ». **Pas de formulaire dans la page** (différence avec v1 et v2-05 actuel).
3. Clic « S'inscrire » :
   - **Non connecté** → redirection `/login?next=/e/[slug]/register&intent=register` (onglet « Créer un compte » mis en avant).
   - **Connecté + profil complet** → `/e/[slug]/register` (formulaire pré-rempli, ne demande que la catégorie).
   - **Connecté + profil incomplet** → `/account/profile/complete?next=/e/[slug]/register` (force la complétion des champs manquants).
4. Sur `/e/[slug]/register` : la page affiche les infos profil en lecture seule, le choix de catégorie, et le bouton « Valider mon inscription ». Le participant peut cliquer « Modifier mon profil » qui le renvoie sur `/account/profile?next=/e/[slug]/register`.
5. Soumission : création `Registration` avec snapshot inline. Status `PENDING`. Email de confirmation envoyé.
6. Page de succès `/e/[slug]/success` (similaire au design v2-05 actuel).

### 2.2 Approbation / rejet (côté event admin, inchangé)

Le modèle reste celui de v1 / v2-04 : l'admin event/org approuve ou rejette via l'espace admin. Aucun changement de cette spec.

### 2.3 Édition après rejet (refonte majeure)

- L'email de rejet contient un lien vers `/account/registrations/[id]` (compte requis ; si non logué, login puis redirection).
- Page `/account/registrations/[id]` :
  - Affiche le statut, la raison de rejet, les infos snapshot, le lien vers l'event.
  - Si `status === REJECTED` : bouton « Modifier mon profil et resoumettre ».
  - Clic → `/account/profile?next=/account/registrations/[id]&intent=resubmit`.
  - L'utilisateur édite son profil, sauvegarde, revient sur la page registration.
  - Bouton « Resoumettre » → `POST /api/account/registrations/[id]/resubmit` : re-snapshot du profil dans `Registration`, status remis à `PENDING`, email « inscription resoumise » envoyé.

Aucun `editToken` n'est utilisé dans ce flux. La sécurité est assurée par : (a) session NextAuth, (b) RBAC `userId === session.user.id` sur les routes `/api/account/*`.

### 2.4 Gestion du profil hors flux event

Le participant peut éditer son profil à tout moment via `/account/profile`. Ces modifications **n'affectent pas les `Registration` existantes** (snapshots inline préservés). Seules les nouvelles inscriptions et les resoumissions prennent en compte le profil à jour.

---

## Section 3 — Pages

| Route | Type | Description |
|---|---|---|
| `/login` | public | Login NextAuth Credentials (staff et participants confondus) |
| `/register` | public | Création de compte participant : email + password + nom + recaptcha |
| `/verify-email/[token]` | public | Vérification de l'email via lien |
| `/forgot-password` | public | Saisie email pour reset |
| `/reset-password/[token]` | public | Saisie nouveau mot de passe via lien |
| `/account` | auth | Dashboard : liste des inscriptions du user + lien profil |
| `/account/profile` | auth | Édition des infos personnelles (nom, prénom, structure, photo, ID) |
| `/account/profile/complete` | auth | Variante guidée du profil pour première complétion (avec param `next`) |
| `/account/registrations/[id]` | auth + scope | Détail d'une registration appartenant au user |
| `/e/[slug]` | public | Page event (présentation + bouton S'inscrire) |
| `/e/[slug]/register` | auth | Formulaire de validation d'inscription (compte requis, profil complet requis) |
| `/e/[slug]/success` | auth | Page succès post-inscription |
| `/verify/[badgeId]` | public | Vérification publique de badge (inchangé v2-05) |

**Pages supprimées du design v2-05 actuel** :

- `/edit-registration/[token]` — remplacée par `/account/registrations/[id]`.

---

## Section 4 — Routes API

### 4.1 Auth participant

| Route | Méthode | Description |
|---|---|---|
| `/api/auth/register` | POST | Création de compte : valide email (recaptcha + BlockedEmail), hash password, envoie email de vérification, log `USER_REGISTERED`. |
| `/api/auth/verify-email` | POST | Body : `{ token }`. Set `emailVerifiedAt`, clear `emailVerifyToken*`. Log `USER_EMAIL_VERIFIED`. |
| `/api/auth/forgot-password` | POST | Body : `{ email }`. Génère token, envoie email reset. Toujours 200 (anti-énumération). Log `USER_PASSWORD_RESET_REQUESTED`. |
| `/api/auth/reset-password` | POST | Body : `{ token, password }`. Valide token + expiry, hash password, clear token. Log `USER_PASSWORD_RESET_COMPLETED`. |
| `/api/auth/[...nextauth]` | déjà existant | `CredentialsProvider` réutilisé tel quel, refuse si `!emailVerifiedAt` ou `blocked`. |

### 4.2 Profil et inscriptions côté participant

| Route | Méthode | Description |
|---|---|---|
| `/api/account/profile` | GET | Renvoie le profil du user connecté (sans password). |
| `/api/account/profile` | PUT | Met à jour les champs profil. Vérifie `BlockedDocument` sur `idDocumentNumber`. Recalcule `participantProfileCompletedAt`. Log `USER_PROFILE_UPDATED`. |
| `/api/account/registrations` | GET | Liste des `Registration` du user (avec event, status). |
| `/api/account/registrations/[id]` | GET | Détail d'une registration (vérifie `userId === session.user.id`). |
| `/api/account/registrations/[id]/resubmit` | POST | Re-snapshot du profil + status `PENDING` + email. Refuse si status ≠ `REJECTED`. |

### 4.3 Inscription event (refonte)

| Route | Méthode | Description |
|---|---|---|
| `/api/events/[slug]/register` | POST | Body : `{ categoryId }`. Vérifie : session, profil complet, event ouvert, quota org, pas déjà inscrit (`@@unique`). Crée `Registration` avec snapshot, envoie email confirmation, log activité. |

**Suppressions** :

- `/api/public/events/[slug]/registrations` (v2-05 actuel) : remplacée par `/api/events/[slug]/register` (auth requise).
- `/api/public/edit-registration/[token]` : supprimée.

---

## Section 5 — NextAuth et sessions

Le `CredentialsProvider` NextAuth existant (configuré pour le staff) est **réutilisé tel quel** pour les participants. Modifications minimes dans la fonction `authorize` :

- Refus si `user.blocked === true`.
- Refus si `user.emailVerifiedAt === null` (avec message clair : « Vérifiez votre email avant de vous connecter »).

Le JWT continue de contenir `id`, `email`, `name`. Le rôle est résolu côté serveur via `loadUserContext()` (multi-tenancy-rbac.md) qui distingue staff / org / event / participant selon les memberships.

Un participant qui tente d'accéder à `/admin/[orgId]/*` ou `/staff/*` est rejeté par les helpers RBAC déjà en place (`requireStaff`, `requireOrgRole`). Pas de mécanisme dédié à créer.

---

## Section 6 — Templates email

Nouveaux templates (cf. v2-06 notifications-email.md) :

| Template | Déclencheur | Contenu |
|---|---|---|
| `account-verify-email` | `POST /api/auth/register` | Lien `/verify-email/[token]` valide 24h |
| `account-password-reset` | `POST /api/auth/forgot-password` | Lien `/reset-password/[token]` valide 1h |
| `registration-confirmed` | `POST /api/events/[slug]/register` | Confirmation + récap event |
| `registration-resubmitted` | `POST /api/account/registrations/[id]/resubmit` | Confirmation resoumission |

Les templates existants `registration-approved` / `registration-rejected` (v1) sont conservés, mais le lien d'édition dans `registration-rejected` est remplacé par `/account/registrations/[id]` (compte requis).

Résolveur SMTP en cascade `Event → Org → Platform` déjà en place (v2-06) : inchangé. Pour les emails non liés à un event (`account-verify-email`, `account-password-reset`), on utilise le SMTP plateforme par défaut.

---

## Section 7 — Impacts sur les autres specs v2

| Spec | Impact | Action |
|---|---|---|
| `v2-01 multi-tenancy-rbac.md` | Ajout des champs profil participant sur `User`, mention du « participant » comme rôle implicite. | Patch dans le même PR que cette spec. |
| `v2-05 inscription-publique.md` | Suppression `/edit-registration/[token]`, refonte du flux `/e/[slug]`, suppression `SubmissionSnapshot`, ajout dépendance compte. | Réécrire la sous-spec ou la marquer **superseded** et créer un nouveau fichier v2-05bis. À trancher au moment du plan d'implémentation. |
| `v2-06 notifications-email.md` | Ajout des 4 nouveaux templates email. | Patch. |
| `v2-04 espace-evenement.md` | La gestion `Registration` côté event admin reste la même (approuver/rejeter), mais les champs viennent du snapshot. Petit patch UI possible (afficher « voir profil compte » en lecture seule). | Patch léger. |
| `v2-12 templates-badges.md` (spec sœur) | Les `TemplateContext.participant.*` champs sont alimentés depuis le snapshot Registration. Aucun changement de contrat. | Aucun. |

---

## Section 8 — Critères d'acceptation de l'implémentation

L'implémentation de cette spec est considérée terminée quand :

1. Le schéma Prisma reflète les changements §1 (`User` enrichi, `Registration` refondue, `SubmissionSnapshot` supprimé, `editToken*` supprimés).
2. Les routes `/api/auth/register`, `/api/auth/verify-email`, `/api/auth/forgot-password`, `/api/auth/reset-password` existent et passent leurs tests d'intégration.
3. Les pages `/register`, `/login`, `/verify-email/[token]`, `/forgot-password`, `/reset-password/[token]` rendent correctement et un E2E couvre le golden path d'inscription compte + vérification.
4. Les pages `/account`, `/account/profile`, `/account/registrations/[id]` rendent correctement, un E2E couvre le golden path d'édition profil et un autre couvre le resubmit.
5. Le flux `/e/[slug]` → login → `/e/[slug]/register` → succès est testé en E2E.
6. Les sous-specs `v2-01`, `v2-05`, `v2-06`, `v2-04` sont mises à jour.
7. Aucun code ne fait plus référence à `editToken`, `editTokenExpiresAt`, `SubmissionSnapshot`, ni aux pages `/edit-registration/[token]`.
8. `BlockedEmail` et `BlockedDocument` sont vérifiés aux bons endroits (création compte, mise à jour profil) avec un test d'intégration chacun.
9. Le seed (`prisma/seed.ts`) crée au moins un user staff vérifié et un user participant vérifié pour les tests/démos.

---

## Section 9 — Hors périmètre (YAGNI explicite)

- **OAuth (Google, Microsoft, etc.)** : aucun besoin business identifié. Si demande, spec dédiée.
- **2FA / TOTP** : ni pour le staff ni pour les participants. À introduire si exigence sécurité.
- **Magic links** : alternative à mot de passe rejetée (cf. ADR). Réévaluable si pic de plaintes mot de passe oublié.
- **Suppression de compte / RGPD côté UI** (export, anonymisation, droit à l'oubli) : spec RGPD dédiée à venir.
- **Fusion de comptes** (un participant a créé deux comptes avec des emails différents) : pas d'outil dédié. Le staff peut bloquer un compte manuellement.
- **Sessions longue durée différentes selon le rôle** : NextAuth standard (JWT 30 jours configurable) suffit.
- **Notifications push / app mobile** : hors v2.
- **Profil d'organisation** (l'org gère ses propres membres dans son espace org) : déjà couvert par v2-03 et inchangé par cette spec.
- **Historique multi-versions par registration** : `SubmissionSnapshot` est supprimé. Le snapshot inline préserve l'état au moment de la soumission. Si plus tard on veut un audit fin des resoumissions, on réintroduira proprement.
