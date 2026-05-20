# API -- Authentification

## POST /api/auth/[...nextauth]

Handler NextAuth.js. Gere le login et la gestion de session.

- **Authentification** : non requise
- **Provider** : Credentials (email + mot de passe)
- **Session** : JWT

### Login

```
POST /api/auth/callback/credentials
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "motdepasse"
}
```

En cas de succes, un cookie de session JWT est defini. En cas d'echec, NextAuth retourne une erreur.

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
  "message": "Mot de passe defini avec succes"
}
```

### Erreurs

| Code | Cas |
|------|-----|
| 400 | Token ou mot de passe manquant |
| 400 | Token invalide ou expire |

### Comportement

1. Recherche l'utilisateur par `inviteToken`
2. Verifie que `inviteTokenExpiry` n'est pas depassee
3. Hash le mot de passe avec bcrypt (12 rounds)
4. Met a jour le mot de passe et efface le token d'invitation
