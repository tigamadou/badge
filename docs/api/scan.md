# API -- Scan

## POST /api/scan

Enregistre un scan de badge QR. Cree une entree dans le journal d'activite (type BADGE_SCANNED).

- **Authentification** : requise
- **Role minimum** : OPERATOR

### Requete

```json
{
  "registrationId": "1260524381003"
}
```

### Reponse (200)

```json
{
  "valid": true,
  "registration": {
    "id": "1260524381003",
    "lastName": "Dupont",
    "firstName": "Jean",
    "structure": "Ministere X",
    "photo": "photos/abc123.jpg",
    "status": "APPROVED",
    "allAccessGranted": false,
    "team": {
      "name": "Protocole",
      "color": "#2563EB"
    }
  },
  "scanLog": {
    "id": "activity-log",
    "scannedAt": "2026-05-24T14:30:00.000Z"
  }
}
```

Le champ `valid` indique si le badge est valide (inscription approuvee).

### Comportement

1. Recherche l'inscription par ID
2. Enregistre l'action dans le journal d'activite (type `BADGE_SCANNED`)
3. Retourne les informations de l'inscription

### Erreurs

| Code | Cas |
|------|-----|
| 400 | registrationId manquant |
| 404 | Inscription non trouvee |

L'historique des scans est consultable via `GET /api/activity-logs?type=scan`. Voir [Journal d'activite](journal-activite.md).
