# API -- Scan

## POST /api/scan

Enregistre un scan de badge QR. Cree une entree dans le journal des scans.

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
    "id": "clxxx...",
    "scannedAt": "2026-05-24T14:30:00.000Z"
  }
}
```

### Comportement

1. Recherche l'inscription par ID
2. Cree un `ScanLog` lie a l'inscription et a l'operateur connecte
3. Retourne les informations de l'inscription et du scan

### Erreurs

| Code | Cas |
|------|-----|
| 400 | registrationId manquant |
| 404 | Inscription non trouvee |

---

## GET /api/scan-logs

Liste l'historique des scans avec filtres et pagination.

- **Authentification** : requise
- **Role minimum** : OPERATOR

### Parametres de requete

| Parametre | Type | Description |
|-----------|------|-------------|
| page | int | Numero de page (defaut: 1) |
| limit | int | Nombre par page (defaut: 50) |
| operatorId | string | Filtrer par operateur |
| registrationId | string | Filtrer par inscription |
| search | string | Recherche par nom ou structure du participant |
| startDate | string (ISO) | Date de debut |
| endDate | string (ISO) | Date de fin |

### Reponse (200)

```json
{
  "scanLogs": [
    {
      "id": "clxxx...",
      "scannedAt": "2026-05-24T14:30:00.000Z",
      "registration": {
        "id": "1260524381003",
        "lastName": "Dupont",
        "firstName": "Jean",
        "structure": "Ministere X",
        "team": {
          "name": "Protocole",
          "color": "#2563EB"
        }
      },
      "user": {
        "id": "clxxx...",
        "name": "Jean Operateur"
      }
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 50
}
```
