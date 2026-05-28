# Reference API

## Generalites

L'API REST est exposee sous le chemin `/api/`. Toutes les requetes et reponses utilisent le format JSON (sauf upload de fichiers en `multipart/form-data`).

### Authentification

L'authentification repose sur NextAuth.js avec des sessions JWT. Les routes protegees verifient la session via `getServerSession()`. Le token JWT contient l'identifiant (`id`), l'email, le nom et le role de l'utilisateur. La connexion est tracee par un log d'activite `USER_LOGIN`.

### Roles

L'application definit quatre roles hierarchiques. La fonction `checkRole(userRole, requiredRole)` valide qu'un utilisateur dispose d'un niveau au moins egal au minimum requis.

| Role | Niveau | Champ d'action principal |
|------|--------|-------------------------|
| OPERATOR | 1 | Scanner les badges |
| MODERATEUR | 2 | Inscriptions, badges, categories, scan |
| ADMIN | 3 | Evenement, parametres SMTP/contact, journal d'activite |
| SUPER_ADMIN | 4 | Utilisateurs, ouverture des inscriptions, reCAPTCHA |

Notes :
- Le SUPER_ADMIN ne peut pas approuver/rejeter/supprimer une inscription ni imprimer un badge (separation des roles).
- L'ouverture/fermeture des inscriptions publiques (`registrationOpen` sur l'evenement) est reservee au SUPER_ADMIN.
- Seul le SUPER_ADMIN gere la cle secrete reCAPTCHA (`recaptchaSecretKey`).
- `GET /api/event` et `GET /api/settings` sont publiques en lecture, mais `recaptchaSecretKey` n'est jamais retournee.

### Codes HTTP

| Code | Utilisation |
|------|-------------|
| 200 | Succes |
| 201 | Creation reussie |
| 400 | Requete invalide (champs manquants, validation echouee, contacts non configures) |
| 401 | Non authentifie |
| 403 | Role insuffisant ou action interdite (ex: SUPER_ADMIN sur validation) |
| 404 | Ressource non trouvee |
| 409 | Conflit (ex: email deja utilise, numero de categorie deja pris) |
| 500 | Erreur serveur |

## Groupes d'endpoints

- [Authentification](authentification.md) -- Login, setup password, profil (`/api/profile`, `/api/profile/password`)
- [Inscriptions](inscriptions.md) -- CRUD inscriptions, impression batch, blocage email/document, detection de doublons, lien d'edition (`/api/edit-registration/[token]`)
- [Utilisateurs](utilisateurs.md) -- Gestion des comptes (SUPER_ADMIN)
- [Categories](categories.md) -- Gestion des categories (alias equipes)
- [Scan](scan.md) -- Scan QR
- [Evenement](evenement.md) -- Configuration de l'evenement, ouverture des inscriptions
- [Parametres](parametres.md) -- SMTP, contact, reCAPTCHA
- [Journal d'activite](journal-activite.md) -- Logs d'activite
- [Fichiers](fichiers.md) -- Upload et telechargement de fichiers
