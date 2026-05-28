# API -- Utilisateurs

Toutes les routes de ce groupe requierent le role SUPER_ADMIN.

## GET /api/users

Liste paginee des utilisateurs (les comptes SUPER_ADMIN sont exclus de la reponse).

- **Authentification** : requise
- **Role minimum** : SUPER_ADMIN

### Parametres de requete

| Parametre | Type | Defaut | Description |
|-----------|------|--------|-------------|
| `page` | int | `1` | Numero de page (>= 1) |
| `limit` | int | `20` | Nombre d'utilisateurs par page (1 a 100) |

### Reponse (200)

```json
{
  "data": [
    {
      "id": "clxxx...",
      "name": "Jean Operateur",
      "email": "jean@example.com",
      "role": "OPERATOR",
      "createdAt": "2026-05-10T10:00:00.000Z"
    }
  ],
  "total": 12,
  "page": 1,
  "totalPages": 1
}
```

### Erreurs

| Code | Cas |
|------|-----|
| 403 | Role insuffisant |

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

| Champ | Type | Obligatoire | Valeurs |
|-------|------|-------------|---------|
| `name` | string | oui | -- |
| `email` | string | oui | Doit etre unique |
| `role` | string | oui | `OPERATOR`, `MODERATEUR`, `ADMIN`, `SUPER_ADMIN` |

### Reponse (201)

```json
{
  "id": "clxxx...",
  "name": "Jean Operateur",
  "email": "jean@example.com",
  "role": "OPERATOR",
  "createdAt": "2026-05-28T09:00:00.000Z"
}
```

### Comportement

1. Verifie que les informations de contact (email + telephone) sont configurees dans les parametres systeme (sinon `400`)
2. Genere un `inviteToken` UUID et `inviteTokenExpiry` a +48h
3. Hash un mot de passe temporaire aleatoire (l'utilisateur ne le connaitra pas)
4. Cree l'utilisateur en base
5. Envoie un email d'invitation contenant le lien `/setup-password?token=<token>` (asynchrone, erreurs loggees)
6. Ajoute une entree `USER_CREATED` au journal d'activite

### Erreurs

| Code | Cas |
|------|-----|
| 400 | Champs obligatoires manquants |
| 400 | Informations de contact (email/telephone) non configurees |
| 403 | Role insuffisant |
| 409 | Email deja utilise |

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

Tous les champs sont optionnels. Seuls les champs fournis sont mis a jour. Si `password` est fourni, il est hashe avec bcrypt (12 rounds).

### Reponse (200)

Objet utilisateur mis a jour (`id`, `name`, `email`, `role`, `createdAt`).

Une entree `USER_UPDATED` est ajoutee au journal d'activite.

### Erreurs

| Code | Cas |
|------|-----|
| 403 | Role insuffisant |
| 404 | Utilisateur non trouve |

---

## DELETE /api/users/[id]

Supprime un utilisateur.

- **Authentification** : requise
- **Role minimum** : SUPER_ADMIN

### Reponse (200)

```json
{
  "success": true
}
```

Une entree `USER_DELETED` est ajoutee au journal d'activite.

### Erreurs

| Code | Cas |
|------|-----|
| 400 | Tentative de se supprimer soi-meme |
| 403 | Role insuffisant |
| 404 | Utilisateur non trouve |

---

## Endpoints lies au profil de l'utilisateur connecte

Les endpoints suivants permettent a un utilisateur de gerer son propre compte (n'importe quel role authentifie) et sont documentes dans [Authentification](authentification.md) :

- `GET /api/profile`
- `PATCH /api/profile`
- `POST /api/profile/password`
