# Reference API

## Generalites

L'API REST est exposee sous le chemin `/api/`. Toutes les requetes et reponses utilisent le format JSON (sauf upload de fichiers en `multipart/form-data`).

### Authentification

L'authentification repose sur NextAuth.js avec des sessions JWT. Les routes protegees verifient la session via `getServerSession()`. Le token JWT contient l'identifiant, l'email, le nom et le role de l'utilisateur.

### Roles

Certaines routes requierent un role minimum :

| Role | Niveau |
|------|--------|
| OPERATOR | 1 |
| ADMIN | 2 |
| SUPER_ADMIN | 3 |

### Codes HTTP

| Code | Utilisation |
|------|-------------|
| 200 | Succes |
| 201 | Creation reussie |
| 400 | Requete invalide (champs manquants, validation echouee) |
| 401 | Non authentifie |
| 403 | Role insuffisant |
| 404 | Ressource non trouvee |
| 500 | Erreur serveur |

## Groupes d'endpoints

- [Authentification](authentification.md) -- Login et setup password
- [Inscriptions](inscriptions.md) -- CRUD inscriptions et impression batch
- [Utilisateurs](utilisateurs.md) -- Gestion des comptes
- [Categories](categories.md) -- Gestion des categories
- [Scan](scan.md) -- Scan QR et historique
- [Evenement](evenement.md) -- Configuration de l'evenement
- [Parametres](parametres.md) -- SMTP et contact
- [Fichiers](fichiers.md) -- Upload et telechargement de fichiers
