# API -- Utilisateurs

Toutes les routes de ce groupe requierent le role SUPER_ADMIN.

## GET /api/users

Liste tous les utilisateurs (sauf les SUPER_ADMIN).

- **Authentification** : requise
- **Role minimum** : SUPER_ADMIN

### Reponse (200)

```json
[
  {
    "id": "clxxx...",
    "name": "Jean Operateur",
    "email": "jean@example.com",
    "role": "OPERATOR",
    "createdAt": "2026-05-10T10:00:00.000Z"
  }
]
```

---

## POST /api/users

Cree un nouvel utilisateur et envoie un email d'invitation.

- **Authentification** : requise
- **Role minimum** : SUPER_ADMIN

### Requete

```json
{
  "name": "Jean Operateur",
  "email": "jean@example.com",
  "role": "OPERATOR"
}
```

### Reponse (201)

```json
{
  "id": "clxxx...",
  "name": "Jean Operateur",
  "email": "jean@example.com",
  "role": "OPERATOR",
  "inviteToken": "uuid-token"
}
```

### Comportement

1. Genere un token d'invitation (UUID)
2. Definit l'expiration a 48 heures
3. Cree l'utilisateur en base (sans mot de passe)
4. Envoie un email d'invitation avec le lien `/setup-password?token=<token>`

### Erreurs

| Code | Cas |
|------|-----|
| 400 | Champs obligatoires manquants |
| 400 | Email deja utilise |

---

## PATCH /api/users/[id]

Modifie un utilisateur existant.

- **Authentification** : requise
- **Role minimum** : SUPER_ADMIN

### Requete

```json
{
  "name": "Nouveau Nom",
  "email": "nouveau@example.com",
  "role": "ADMIN",
  "password": "nouveaumotdepasse"
}
```

Tous les champs sont optionnels. Seuls les champs fournis sont mis a jour. Si `password` est fourni, il est hashe avec bcrypt.

### Reponse (200)

Objet utilisateur mis a jour.

### Erreurs

| Code | Cas |
|------|-----|
| 404 | Utilisateur non trouve |

---

## DELETE /api/users/[id]

Supprime un utilisateur.

- **Authentification** : requise
- **Role minimum** : SUPER_ADMIN

### Reponse (200)

```json
{
  "message": "Utilisateur supprime"
}
```

### Erreurs

| Code | Cas |
|------|-----|
| 400 | Tentative de se supprimer soi-meme |
| 404 | Utilisateur non trouve |
