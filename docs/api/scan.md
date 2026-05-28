# API -- Scan

## POST /api/scan

Enregistre un scan de badge QR. Cree une entree dans le journal d'activite (type `BADGE_SCANNED`).

- **Authentification** : requise
- **Role minimum** : OPERATOR

### Requete

```json
{
  "registrationId": "1260524381003"
}
```

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| registrationId | string | oui | Identifiant du badge decode depuis le QR code |

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

- Le champ `valid` est `true` uniquement si `registration.status === "APPROVED"`. Pour `PENDING` ou `REJECTED`, la reponse est 200 avec `valid: false` et la `registration` reste detaillee.
- `scanLog.id` retourne la chaine litterale `"activity-log"` (pas l'identifiant reel de l'entree journal).
- `scanLog.scannedAt` est l'horodatage ISO du moment du scan, genere cote serveur.

### Comportement

1. Verifie la session et le role minimum OPERATOR
2. Recherche l'inscription par ID (`prisma.registration.findUnique`) avec la categorie en jointure
3. Enregistre l'action dans le journal d'activite (type `BADGE_SCANNED`) avec : nom complet, structure, nom et couleur de la categorie, statut de l'inscription
4. Retourne les informations de l'inscription, le champ `valid` reflete le statut

### Erreurs

| Code | Reponse | Cas |
|------|---------|-----|
| 400 | `{ "error": "registrationId requis" }` | `registrationId` absent du corps |
| 403 | `{ "error": "Acces refuse" }` | Session absente ou role inferieur a OPERATOR |
| 404 | `{ "valid": false, "error": "Badge inconnu" }` | Aucune inscription ne correspond a `registrationId` |

L'historique des scans est consultable via `GET /api/activity-logs?type=scan`. Voir [Journal d'activite](journal-activite.md).
