# API -- Categories

Les categories sont stockees sous le modele `Team` en base de donnees. L'API utilise le chemin `/api/teams`.

## GET /api/teams

Liste les categories avec le nombre d'inscriptions, paginees et triees par nom (ordre croissant).

- **Authentification** : non requise (public)

### Parametres de requete

| Champ | Type | Defaut | Description |
|-------|------|--------|-------------|
| page | int | 1 | Numero de page (minimum 1) |
| limit | int | 20 | Nombre d'elements par page (1-100) |
| excludeAnonymous | bool | false | Si `true`, exclut les categories marquees `anonymous` (utilise par le formulaire public d'inscription) |

### Reponse (200)

```json
{
  "data": [
    {
      "id": "clxxx...",
      "name": "Securite",
      "color": "#DC2626",
      "number": 1,
      "neutralBadge": false,
      "anonymous": false,
      "_count": {
        "registrations": 15
      }
    }
  ],
  "total": 12,
  "page": 1,
  "totalPages": 1
}
```

---

## POST /api/teams

Cree une nouvelle categorie.

- **Authentification** : requise
- **Role minimum** : MODERATEUR

### Requete

```json
{
  "name": "Protocole",
  "color": "#2563EB",
  "number": 2,
  "neutralBadge": false,
  "anonymous": false
}
```

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| name | string | oui | Nom de la categorie |
| color | string | oui | Couleur hexadecimale (ex: `#2563EB`) |
| number | int | oui | Numero unique entre 0 et 999 |
| neutralBadge | bool | non | Defaut `false`. Si `true`, badge a fond blanc avec couleur appliquee au texte |
| anonymous | bool | non | Defaut `false`. Si `true`, categorie masquee sur le formulaire public et auto-approbation |

### Reponse (201)

Objet categorie cree (champs : `id`, `name`, `color`, `number`, `neutralBadge`, `anonymous`).

Une entree de journal de type `CATEGORY_CREATED` est ajoutee.

### Erreurs

| Code | Reponse | Cas |
|------|---------|-----|
| 400 | `{ "error": "Nom, couleur et numéro requis" }` | Champ obligatoire manquant |
| 400 | `{ "error": "Le numéro doit être entre 0 et 999" }` | Numero hors plage |
| 403 | `{ "error": "Accès refusé" }` | Role insuffisant |
| 409 | `{ "error": "Ce numéro est déjà utilisé par une autre catégorie" }` | Conflit d'unicite sur `number` |

---

## PATCH /api/teams/[id]

Modifie une categorie existante.

- **Authentification** : requise
- **Role minimum** : MODERATEUR

### Requete

```json
{
  "name": "Nouveau Nom",
  "color": "#16A34A",
  "number": 3,
  "neutralBadge": true,
  "anonymous": false
}
```

Tous les champs sont optionnels. Les champs absents ne sont pas modifies.

### Reponse (200)

Objet categorie mis a jour. Une entree de journal de type `CATEGORY_UPDATED` est ajoutee.

### Erreurs

| Code | Reponse | Cas |
|------|---------|-----|
| 400 | `{ "error": "Le numéro doit être entre 0 et 999" }` | Numero hors plage |
| 403 | `{ "error": "Accès refusé" }` | Role insuffisant |
| 409 | `{ "error": "Ce numéro est déjà utilisé par une autre catégorie" }` | Conflit d'unicite sur `number` |

---

## DELETE /api/teams/[id]

Supprime une categorie.

- **Authentification** : requise
- **Role minimum** : MODERATEUR

### Reponse (200)

```json
{
  "success": true
}
```

Une entree de journal de type `CATEGORY_DELETED` est ajoutee.

### Erreurs

| Code | Reponse | Cas |
|------|---------|-----|
| 403 | `{ "error": "Accès refusé" }` | Role insuffisant |

> Note : la suppression ne verifie pas l'existence prealable (`prisma.team.delete` peut lever une erreur Prisma si l'id n'existe pas). Aucune logique de bascule des inscriptions associees n'est implementee : les inscriptions liees a la categorie supprimee perdront leur reference (contrainte FK).
