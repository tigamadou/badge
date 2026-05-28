# Base de donnees

## Vue d'ensemble

La base de donnees MySQL 8 est geree via Prisma ORM. Le schema est defini dans `prisma/schema.prisma`.

## Diagramme des relations

```
User ──> ActivityLog (1:N, SetNull si User supprime)

Registration ──> Team (N:1)
Registration ──> SubmissionSnapshot (1:N, Cascade)

BlockedEmail     (independant)
BlockedDocument  (independant)
Event            (independant, singleton)
Settings         (independant, singleton)
```

- Un `User` peut avoir plusieurs `ActivityLog` (relation optionnelle via `userId`, SetNull a la suppression de l'utilisateur).
- Une `Registration` appartient a un `Team` et porte un historique de `SubmissionSnapshot` (Cascade a la suppression).
- `BlockedEmail` et `BlockedDocument` sont des listes noires globales.
- `Event` et `Settings` sont des singletons (un seul enregistrement).

## Modeles

### User

Comptes des operateurs, moderateurs et administrateurs.

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| id | String | PK, cuid | Identifiant unique |
| email | String | unique | Adresse email |
| password | String | -- | Hash bcrypt du mot de passe |
| name | String | -- | Nom complet |
| role | Role | default: OPERATOR | Role de l'utilisateur |
| inviteToken | String? | unique | Token d'invitation (UUID) |
| inviteTokenExpiry | DateTime? | -- | Expiration du token (48h) |
| createdAt | DateTime | default: now() | Date de creation |

Relations : `activityLogs` (ActivityLog[])

### Event

Informations sur l'evenement (unique).

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| id | String | PK, cuid | Identifiant unique |
| title | String | -- | Titre de l'evenement |
| location | String | -- | Lieu |
| date | DateTime | -- | Date |
| logo | String? | -- | Chemin du fichier logo |
| registrationOpen | Boolean | default: true | Ouverture des inscriptions publiques (SUPER_ADMIN seul) |

### Team

Categories de participants (anciennement "equipes" -- les deux termes coexistent dans le code).

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| id | String | PK, cuid | Identifiant unique |
| name | String | -- | Nom de la categorie |
| color | String | -- | Couleur hex (ex: #DC2626) |
| number | Int | unique | Numero 0-999, dernier chiffre utilise dans l'ID de badge |
| neutralBadge | Boolean | default: false | Genere un badge sans nom/structure (badge generique) |
| anonymous | Boolean | default: false | Inscriptions admin-only, approuvees automatiquement, badge anonyme |

Relations : `registrations` (Registration[])

### Registration

Inscriptions des participants.

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| id | String | PK | ID genere (12 caracteres, voir ci-dessous) |
| email | String | -- | Email du participant (optionnel pour categorie anonyme) |
| lastName | String | -- | Nom de famille |
| firstName | String | -- | Prenom |
| structure | String | -- | Organisation / structure |
| photo | String? | -- | Chemin du fichier photo |
| idDocumentType | String | -- | Type de piece d'identite |
| idDocumentNumber | String | -- | Numero de piece d'identite |
| idDocument | String? | -- | Chemin du fichier document |
| status | RegistrationStatus | default: PENDING | Statut de l'inscription |
| badgePrinted | Boolean | default: false | Badge imprime ou non |
| badgePrintedAt | DateTime? | -- | Date d'impression |
| allAccessGranted | Boolean | default: false | Acces total accorde |
| rejectionReason | String? | -- | Motif de rejet (predefini) |
| rejectionDetails | Text? | -- | Details libres du rejet |
| editToken | String? | unique | Token d'edition (UUID) genere a chaque rejet |
| editTokenExpiresAt | DateTime? | -- | Expiration du token d'edition (48h) |
| teamId | String | FK -> Team.id | Categorie du participant |
| createdAt | DateTime | default: now() | Date d'inscription |

Relations : `team` (Team), `snapshots` (SubmissionSnapshot[])

#### Format de l'identifiant

L'ID est genere par `src/lib/generate-id.ts` selon le format : `[catLast][YY][MM][JJ][XX][catLast][NNN]` (12 caracteres).

- `catLast` : dernier chiffre du numero de categorie
- `YY MM JJ` : date de l'evenement (annee, mois, jour sur 2 chiffres)
- `XX` : 2 chiffres aleatoires (00-99)
- `catLast` : repetition du dernier chiffre du numero de categorie
- `NNN` : compteur sequentiel par categorie a 3 chiffres (001, 002, ...)

Exemple : categorie n.17 (dernier chiffre = 7), date 28/05/2026, aleatoire 42, sequence 3 -> `7260528427003`.

### SubmissionSnapshot

Historique des soumissions/resoumissions d'une inscription.

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| id | String | PK, cuid | Identifiant unique |
| registrationId | String | FK -> Registration.id (Cascade) | Inscription associee |
| lastName | String | -- | Nom de famille a ce moment |
| firstName | String | -- | Prenom a ce moment |
| email | String | -- | Email a ce moment |
| structure | String | -- | Structure a ce moment |
| teamId | String | -- | Categorie a ce moment |
| idDocumentType | String | -- | Type de doc a ce moment |
| idDocumentNumber | String | -- | Numero de doc a ce moment |
| photo | String? | -- | Photo a ce moment |
| idDocument | String? | -- | Document a ce moment |
| createdAt | DateTime | default: now() | Date du snapshot |

Index : `registrationId`.

Note : un snapshot est cree a chaque creation et a chaque resoumission via le lien d'edition.

### BlockedEmail

Liste noire des emails.

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| id | String | PK, cuid | Identifiant unique |
| email | String | unique | Email bloque |
| reason | String? | -- | Motif du blocage |
| createdAt | DateTime | default: now() | Date du blocage |

Note : toute nouvelle inscription avec ce email est rejetee silencieusement (200 OK mais aucune creation).

### BlockedDocument

Liste noire des numeros de document d'identite. Memes champs que `BlockedEmail` avec `documentNumber` a la place de `email`.

### ActivityLog

Journal de toutes les actions effectuees dans l'application.

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| id | String | PK, cuid | Identifiant unique |
| type | ActivityType | enum | Type d'action |
| userId | String? | FK -> User.id (onDelete: SetNull) | Utilisateur ayant effectue l'action |
| targetId | String? | -- | ID de la ressource concernee |
| details | JSON? | -- | Contexte lisible de l'action |
| ipAddress | String? | -- | Adresse IP (capture automatique via `req`) |
| userAgent | Text? | -- | User-Agent (capture automatique via `req`) |
| createdAt | DateTime | default: now() | Date et heure |

Index : `type`, `userId`, `createdAt`.

Relations : `user` (User?)

### Settings

Parametres de configuration du systeme (unique).

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| id | String | PK, cuid | Identifiant unique |
| smtpHost | String | default: "" | Serveur SMTP |
| smtpPort | Int | default: 587 | Port SMTP |
| smtpFrom | String | default: "" | Adresse expediteur |
| smtpUser | String | default: "" | Utilisateur SMTP (auth) |
| smtpPassword | String | default: "" | Mot de passe SMTP (auth) |
| smtpSecure | Boolean | default: false | Connexion TLS |
| contactEmail | String | default: "" | Email de contact (affichage public, obligatoire pour valider/rejeter/imprimer) |
| contactPhone | String | default: "" | Telephone de contact (affichage public) |
| recaptchaEnabled | Boolean | default: false | Activation reCAPTCHA pour le formulaire public |
| recaptchaSiteKey | String | default: "" | Cle publique reCAPTCHA (lecture publique) |
| recaptchaSecretKey | String | default: "" | Cle secrete reCAPTCHA (SUPER_ADMIN seul, jamais exposee) |

## Enumerations

### Role

```
SUPER_ADMIN  -- Utilisateurs, ouverture inscriptions, reCAPTCHA (niveau 4)
ADMIN        -- Evenement, parametres SMTP/contact, journal d'activite (niveau 3)
MODERATEUR   -- Inscriptions, badges, categories, scan, dashboard global (niveau 2)
OPERATOR     -- Scan QR uniquement (niveau 1)
```

### RegistrationStatus

```
PENDING   -- En attente de validation
APPROVED  -- Approuvee
REJECTED  -- Rejetee (genere automatiquement un editToken 48h)
```

### ActivityType

```
REGISTRATION_CREATED, REGISTRATION_APPROVED, REGISTRATION_REJECTED,
REGISTRATION_UPDATED, REGISTRATION_DELETED,
REGISTRATION_RESUBMITTED, EDIT_LINK_SENT,
BADGE_PRINTED, BADGE_BATCH_PRINTED, BADGE_ALL_ACCESS_TOGGLED,
BADGE_EXPORTED, BADGE_BATCH_EXPORTED, BADGE_SCANNED,
USER_CREATED, USER_UPDATED, USER_DELETED, USER_PASSWORD_SET, USER_LOGIN,
CATEGORY_CREATED, CATEGORY_UPDATED, CATEGORY_DELETED,
EVENT_UPDATED, SETTINGS_UPDATED
```

Note : `REGISTRATION_RESUBMITTED` et `EDIT_LINK_SENT` ne figurent pas actuellement dans les `TYPE_GROUPS` exploites par l'UI du journal d'activite. Ils sont enregistres en BDD mais ne sont pas filtres par la categorie "Inscriptions" de l'interface.

## Migrations

Les migrations Prisma vivent dans `prisma/migrations/`. Apercu chronologique :

| Migration | Description |
|-----------|-------------|
| `20260506000431_init` | Schema initial : User, Event, Team, Registration |
| `20260506053858_add_scan_log` | Ajout (puis suppression ulterieure) de la table ScanLog |
| `20260506100000_add_team_number_and_all_access` | Champ `number` sur Team, `allAccessGranted` sur Registration |
| (evolutions ulterieures) | Suppression de ScanLog, ajout de ActivityLog avec enum ActivityType ; ajout de `registrationOpen` ; ajout du role MODERATEUR ; ajout de `editToken`/`editTokenExpiresAt`, `rejectionReason`/`rejectionDetails` ; ajout de SubmissionSnapshot, BlockedEmail, BlockedDocument ; ajout des flags `neutralBadge` et `anonymous` sur Team ; ajout de `ipAddress`/`userAgent` sur ActivityLog ; ajout de `smtpUser`/`smtpPassword` et de la section reCAPTCHA dans Settings ; ajout des types `REGISTRATION_RESUBMITTED` et `EDIT_LINK_SENT` |

## Donnees initiales (seed)

Le fichier `prisma/seed.ts` initialise les donnees suivantes :

### Utilisateurs

Le seed cree au minimum un compte SUPER_ADMIN a partir des variables d'environnement `SEED_ADMIN_EMAIL` et `SEED_ADMIN_PASSWORD`. Selon la configuration locale, des comptes de demonstration ADMIN, MODERATEUR et OPERATOR peuvent egalement etre ajoutes.

### Categories

| Nom | Couleur | Numero |
|-----|---------|--------|
| Securite | #DC2626 (rouge) | 1 |
| Protocole | #2563EB (bleu) | 2 |
| Presse | #16A34A (vert) | 3 |

### Evenement

- Titre : Ceremonie d'investiture du President de la Republique
- Lieu : Porto-Novo
- Date : 24 mai 2026
- `registrationOpen` : true

### Parametres

- SMTP : mailpit (host: mailpit, port: 1025) en developpement
- Contact : contact@investiture.local / +229 97 00 00 00
- reCAPTCHA : desactive par defaut
