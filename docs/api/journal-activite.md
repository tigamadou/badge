# API -- Journal d'activite

## GET /api/activity-logs

Liste les entrees du journal d'activite avec filtres et pagination.

- **Authentification** : requise
- **Role minimum** : ADMIN

### Parametres de requete

| Parametre | Type | Description |
|-----------|------|-------------|
| type | string | Type d'action (valeur exacte de l'enum) ou groupe (`registration`, `badge`, `scan`, `user`, `config`) |
| userId | string | Filtrer par utilisateur |
| search | string | Recherche dans le JSON `details` (`string_contains` sur le chemin racine `$`) |
| startDate | string (ISO) | Date de debut (`createdAt >= startDate`) |
| endDate | string (ISO) | Date de fin (`createdAt <= endDate + 23:59:59.999Z`) |
| page | int | Numero de page (defaut: 1) |
| limit | int | Nombre par page (defaut: 30, max: 100) |

### Groupes de types

| Groupe | Types inclus |
|--------|-------------|
| registration | REGISTRATION_CREATED, REGISTRATION_APPROVED, REGISTRATION_REJECTED, REGISTRATION_UPDATED, REGISTRATION_DELETED |
| badge | BADGE_PRINTED, BADGE_BATCH_PRINTED, BADGE_ALL_ACCESS_TOGGLED, BADGE_EXPORTED, BADGE_BATCH_EXPORTED |
| scan | BADGE_SCANNED |
| user | USER_CREATED, USER_UPDATED, USER_DELETED, USER_PASSWORD_SET, USER_LOGIN |
| config | CATEGORY_CREATED, CATEGORY_UPDATED, CATEGORY_DELETED, EVENT_UPDATED, SETTINGS_UPDATED |

Les types `REGISTRATION_RESUBMITTED` et `EDIT_LINK_SENT` existent dans la base mais ne sont **pas** rattaches a un groupe : ils ne sont accessibles qu'en filtrant par leur valeur exacte (ou sans filtre `type`).

### Reponse (200)

```json
{
  "logs": [
    {
      "id": "clxxx...",
      "type": "REGISTRATION_APPROVED",
      "userId": "clxxx...",
      "targetId": "1260524381003",
      "details": {
        "registrationName": "Jean DUPONT",
        "previousStatus": "PENDING",
        "newStatus": "APPROVED"
      },
      "ipAddress": "203.0.113.42",
      "userAgent": "Mozilla/5.0 ...",
      "createdAt": "2026-05-11T14:30:00.000Z",
      "user": {
        "id": "clxxx...",
        "name": "Admin",
        "email": "admin@example.com"
      }
    }
  ],
  "total": 150,
  "page": 1,
  "totalPages": 5
}
```

### Erreurs

| Code | Cas |
|------|-----|
| 401 | Non authentifie ou role insuffisant |

---

## POST /api/activity-logs

Enregistre une entree dans le journal (utilise par le front-end pour les exports de badges, qui se font cote client).

- **Authentification** : requise
- **Role minimum** : tout utilisateur connecte

### Requete

```json
{
  "type": "BADGE_EXPORTED",
  "targetId": "1260524381003",
  "details": {
    "registrationName": "Jean DUPONT"
  }
}
```

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| type | ActivityType | oui | Type d'action a enregistrer |
| targetId | string | non | ID de la ressource concernee |
| details | object | non | Donnees contextuelles |

Le `userId` est resolu cote serveur depuis la session ; l'IP et le User-Agent sont captures automatiquement.

### Reponse (200)

```json
{
  "success": true
}
```

### Erreurs

| Code | Cas |
|------|-----|
| 400 | Champ `type` manquant |
| 401 | Non authentifie |
