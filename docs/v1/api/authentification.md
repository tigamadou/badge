# API -- Authentification

## POST /api/auth/[...nextauth]

Handler NextAuth.js. Gere le login et la gestion de session.

- **Authentification** : non requise
- **Provider** : Credentials (email + mot de passe)
- **Session** : JWT
- **Page de connexion** : `/login` (definie via `authOptions.pages.signIn`)

### Login

```
POST /api/auth/callback/credentials
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "motdepasse"
}
```

En cas de succes, un cookie de session JWT est defini et une entree `USER_LOGIN` est ajoutee au journal d'activite. En cas d'echec, NextAuth retourne une erreur (le handler `authorize` repond `null` si l'email est inconnu ou le mot de passe incorrect).

### Contenu du JWT

Le callback `jwt` ajoute deux champs supplementaires au token :

| Champ | Origine | Description |
|-------|---------|-------------|
| `id` | `user.id` | Identifiant interne de l'utilisateur |
| `role` | `user.role` | `OPERATOR`, `MODERATEUR`, `ADMIN` ou `SUPER_ADMIN` |

Ces champs sont propages a `session.user` via le callback `session`, ce qui permet aux endpoints protegers d'appeler `getServerSession()` puis `checkRole(session.user.role, "<MIN>")`.

---

## POST /api/setup-password

Definit le mot de passe d'un utilisateur invite. Utilise lors de la premiere connexion apres reception de l'email d'invitation.

- **Authentification** : non requise (acces public)
- **Validation** : le token doit etre valide et non expire (48h)

### Requete

```json
{
  "token": "uuid-du-token-invitation",
  "password": "nouveaumotdepasse"
}
```

### Reponse (200)

```json
{
  "message": "Mot de passe configure avec succes"
}
```

### Erreurs

| Code | Cas |
|------|-----|
| 400 | Token ou mot de passe manquant |
| 400 | Token invalide ou expire |

### Comportement

1. Recherche l'utilisateur par `inviteToken`
2. Verifie que `inviteTokenExpiry` n'est pas depassee (sinon `400`)
3. Hash le mot de passe avec bcrypt (12 rounds)
4. Met a jour le mot de passe et efface `inviteToken` + `inviteTokenExpiry`
5. Ajoute une entree `USER_PASSWORD_SET` au journal d'activite

---

## GET /api/profile

Retourne les informations de l'utilisateur connecte.

- **Authentification** : requise (session NextAuth)

### Reponse (200)

```json
{
  "id": "clxxx...",
  "name": "Marie Admin",
  "email": "marie@example.com",
  "role": "ADMIN"
}
```

### Erreurs

| Code | Cas |
|------|-----|
| 401 | Non authentifie |
| 404 | Utilisateur introuvable en base |

---

## PATCH /api/profile

Met a jour le nom et / ou l'email de l'utilisateur connecte.

- **Authentification** : requise

### Requete

```json
{
  "name": "Marie Admin",
  "email": "marie.admin@example.com"
}
```

Les deux champs sont optionnels. Seuls les champs fournis sont mis a jour.

### Reponse (200)

Objet utilisateur (id, name, email, role).

### Erreurs

| Code | Cas |
|------|-----|
| 401 | Non authentifie |
| 409 | Email deja utilise par un autre compte |

---

## POST /api/profile/password

Change le mot de passe de l'utilisateur connecte. Necessite la confirmation du mot de passe actuel.

- **Authentification** : requise

### Requete

```json
{
  "currentPassword": "ancienmotdepasse",
  "newPassword": "nouveaumotdepasse"
}
```

### Reponse (200)

```json
{
  "message": "Mot de passe mis à jour"
}
```

### Erreurs

| Code | Cas |
|------|-----|
| 400 | Champs manquants |
| 400 | Mot de passe actuel incorrect |
| 401 | Non authentifie |
| 404 | Utilisateur introuvable |
