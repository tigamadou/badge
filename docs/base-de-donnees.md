# Base de donnees

## Vue d'ensemble

La base de donnees MySQL 8 est geree via Prisma ORM. Le schema est defini dans `prisma/schema.prisma`.

## Diagramme des relations

```
User ──┐
       └──> ActivityLog
                         Registration ──> Team

Event (independant)
Settings (independant)
```

- Un `User` peut avoir plusieurs `ActivityLog`
- Une `Registration` appartient a un `Team`
- Un `Team` peut avoir plusieurs `Registration`
- `Event` et `Settings` sont des entites independantes (pas de FK)

## Modeles

### User

Comptes des operateurs et administrateurs.

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

### Team

Categories de participants (anciennement "equipes").

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| id | String | PK, cuid | Identifiant unique |
| name | String | -- | Nom de la categorie |
| color | String | -- | Couleur hex (ex: #DC2626) |
| number | Int | unique | Numero 1-9, utilise dans l'ID de badge |

Relations : `registrations` (Registration[])

### Registration

Inscriptions des participants.

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| id | String | PK | ID genere (format specifique, voir ci-dessous) |
| email | String | -- | Email du participant |
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
| teamId | String | FK -> Team.id | Categorie du participant |
| createdAt | DateTime | default: now() | Date d'inscription |

Relations : `team` (Team)

#### Format de l'identifiant

L'ID est genere selon le format : `[numCategorie][AAMMJJ][XX][numCategorie][NNN]`

- `numCategorie` : numero de la categorie (1 chiffre)
- `AAMMJJ` : date de l'evenement (annee, mois, jour sur 2 chiffres)
- `XX` : 2 chiffres aleatoires (00-99)
- `numCategorie` : repetition du numero de categorie
- `NNN` : compteur sequentiel a 3 chiffres (001, 002, ...)

Exemple : `1260524381003` -- categorie 1, date 26/05/24, aleatoire 38, categorie 1, inscription n.003.

### ActivityLog

Journal de toutes les actions effectuees dans l'application.

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| id | String | PK, cuid | Identifiant unique |
| type | ActivityType | enum | Type d'action |
| userId | String? | FK -> User.id (onDelete: SetNull) | Utilisateur ayant effectue l'action |
| targetId | String? | -- | ID de la ressource concernee |
| details | JSON? | -- | Contexte lisible de l'action |
| createdAt | DateTime | default: now() | Date et heure |

Index : `type`, `userId`, `createdAt`

Relations : `user` (User?)

### Settings

Parametres de configuration du systeme (unique).

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| id | String | PK, cuid | Identifiant unique |
| smtpHost | String | default: "" | Serveur SMTP |
| smtpPort | Int | default: 587 | Port SMTP |
| smtpFrom | String | default: "" | Adresse expediteur |
| smtpSecure | Boolean | default: false | Connexion TLS |
| contactEmail | String | default: "" | Email de contact |
| contactPhone | String | default: "" | Telephone de contact |

## Enumerations

### Role

```
SUPER_ADMIN  -- Administrateur principal, gere les utilisateurs
ADMIN        -- Administrateur, gere categories/evenement/parametres
OPERATOR     -- Operateur, scanne les badges
```

### RegistrationStatus

```
PENDING   -- En attente de validation
APPROVED  -- Approuvee
REJECTED  -- Rejetee
```

### ActivityType

```
REGISTRATION_CREATED, REGISTRATION_APPROVED, REGISTRATION_REJECTED,
REGISTRATION_UPDATED, REGISTRATION_DELETED,
BADGE_PRINTED, BADGE_BATCH_PRINTED, BADGE_ALL_ACCESS_TOGGLED,
BADGE_EXPORTED, BADGE_BATCH_EXPORTED, BADGE_SCANNED,
USER_CREATED, USER_UPDATED, USER_DELETED, USER_PASSWORD_SET, USER_LOGIN,
CATEGORY_CREATED, CATEGORY_UPDATED, CATEGORY_DELETED,
EVENT_UPDATED, SETTINGS_UPDATED
```

## Migrations

| Migration | Description |
|-----------|-------------|
| `20260506000431_init` | Schema initial : User, Event, Team, Registration |
| `20260506053858_add_scan_log` | Ajout de la table ScanLog |
| `20260506100000_add_team_number_and_all_access` | Ajout du champ `number` sur Team et `allAccessGranted` sur Registration |
| (db push) | Suppression de ScanLog, ajout de ActivityLog avec enum ActivityType |

## Donnees initiales (seed)

Le fichier `prisma/seed.ts` initialise les donnees suivantes :

### Utilisateurs

| Email | Mot de passe | Role |
|-------|-------------|------|
| admin@investiture.local | admin123 | SUPER_ADMIN |
| admin@investiture.local | admin123 | ADMIN |
| operateur@investiture.local | oper123 | OPERATOR |

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

### Parametres

- SMTP : mailpit (host: mailpit, port: 1025)
- Contact : contact@investiture.local / +229 97 00 00 00
