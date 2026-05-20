# API -- Journal d'activite

## GET /api/activity-logs

Liste les entrees du journal d'activite avec filtres et pagination.

- **Authentification** : requise
- **Role minimum** : ADMIN

### Parametres de requete

| Parametre | Type | Description |
|-----------|------|-------------|
| type | string | Type d'action ou groupe (registration, badge, scan, user, config) |
| userId | string | Filtrer par utilisateur |
| search | string | Recherche dans les details |
| startDate | string (ISO) | Date de debut |
| endDate | string (ISO) | Date de fin |
| page | int | Numero de page (defaut: 1) |
| limit | int | Nombre par page (defaut: 30, max: 100) |

### Groupes de types

| Groupe | Types inclus |
|--------|-------------|
| registration | REGISTRATION_CREATED, _APPROVED, _REJECTED, _UPDATED, _DELETED |
| badge | BADGE_PRINTED, _BATCH_PRINTED, _ALL_ACCESS_TOGGLED, _EXPORTED, _BATCH_EXPORTED |
| scan | BADGE_SCANNED |
| user | USER_CREATED, _UPDATED, _DELETED, _PASSWORD_SET, _LOGIN |
| config | CATEGORY_CREATED, _UPDATED, _DELETED, EVENT_UPDATED, SETTINGS_UPDATED |

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

---

## POST /api/activity-logs

Enregistre une entree dans le journal (utilise par le front-end pour les exports de badges).

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

### Reponse (200)

```json
{
  "success": true
}
```
