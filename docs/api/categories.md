# API -- Categories

Les categories sont stockees sous le modele `Team` en base de donnees. L'API utilise le chemin `/api/teams`.

## GET /api/teams

Liste toutes les categories avec le nombre d'inscriptions.

- **Authentification** : non requise (public)

### Reponse (200)

```json
[
  {
    "id": "clxxx...",
    "name": "Securite",
    "color": "#DC2626",
    "number": 1,
    "_count": {
      "registrations": 15
    }
  }
]
```

---

## POST /api/teams

Cree une nouvelle categorie.

- **Authentification** : requise
- **Role minimum** : ADMIN

### Requete

```json
{
  "name": "Protocole",
  "color": "#2563EB",
  "number": 2
}
```

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| name | string | oui | Nom de la categorie |
| color | string | oui | Couleur hexadecimale |
| number | int | oui | Numero unique (1-9) |

### Reponse (201)

Objet categorie cree.

### Erreurs

| Code | Cas |
|------|-----|
| 400 | Champs obligatoires manquants |
| 400 | Numero deja utilise par une autre categorie |

---

## PATCH /api/teams/[id]

Modifie une categorie existante.

- **Authentification** : requise
- **Role minimum** : ADMIN

### Requete

```json
{
  "name": "Nouveau Nom",
  "color": "#16A34A",
  "number": 3
}
```

Tous les champs sont optionnels.

### Reponse (200)

Objet categorie mis a jour.

### Erreurs

| Code | Cas |
|------|-----|
| 404 | Categorie non trouvee |
| 400 | Numero deja utilise |

---

## DELETE /api/teams/[id]

Supprime une categorie.

- **Authentification** : requise
- **Role minimum** : ADMIN

### Reponse (200)

```json
{
  "message": "Categorie supprimee"
}
```

### Erreurs

| Code | Cas |
|------|-----|
| 404 | Categorie non trouvee |
