# Journal d'activite

## Description fonctionnelle

Le journal d'activite enregistre toutes les actions effectuees dans l'application : inscriptions, scans, gestion des badges, gestion des utilisateurs, modifications de configuration. Il remplace l'ancien systeme d'historique des scans (ScanLog) par un systeme de log generique et centralise.

Les administrateurs (ADMIN+) peuvent consulter le journal, le filtrer par type d'action, par utilisateur, par recherche textuelle et par plage de dates.

## Modele de donnees

### ActivityLog

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| id | String | PK, cuid | Identifiant unique |
| type | ActivityType | enum | Type d'action |
| userId | String? | FK -> User (onDelete: SetNull) | Utilisateur ayant effectue l'action |
| targetId | String? | -- | ID de la ressource concernee |
| details | JSON | -- | Contexte lisible de l'action |
| createdAt | DateTime | default: now() | Date et heure |

### Enum ActivityType

```
REGISTRATION_CREATED
REGISTRATION_APPROVED
REGISTRATION_REJECTED
REGISTRATION_UPDATED
REGISTRATION_DELETED
BADGE_PRINTED
BADGE_BATCH_PRINTED
BADGE_ALL_ACCESS_TOGGLED
BADGE_EXPORTED
BADGE_BATCH_EXPORTED
BADGE_SCANNED
USER_CREATED
USER_UPDATED
USER_DELETED
USER_PASSWORD_SET
USER_LOGIN
CATEGORY_CREATED
CATEGORY_UPDATED
CATEGORY_DELETED
EVENT_UPDATED
SETTINGS_UPDATED
```

### Groupes de types (pour le filtre UI)

| Groupe | Types |
|--------|-------|
| Inscriptions | REGISTRATION_* |
| Badges | BADGE_* |
| Scans | BADGE_SCANNED |
| Utilisateurs | USER_* |
| Configuration | CATEGORY_*, EVENT_*, SETTINGS_* |

### Exemples de details (JSON)

Scan de badge :
```json
{
  "registrationName": "Jean DUPONT",
  "structure": "Ministere X",
  "teamName": "Protocole",
  "teamColor": "#2563EB"
}
```

Approbation d'inscription :
```json
{
  "registrationName": "Jean DUPONT",
  "previousStatus": "PENDING",
  "newStatus": "APPROVED"
}
```

Creation d'utilisateur :
```json
{
  "userName": "Jean Operateur",
  "userEmail": "jean@example.com",
  "userRole": "OPERATOR"
}
```

Modification de categorie :
```json
{
  "categoryName": "Protocole",
  "changes": "couleur, numero"
}
```

## Acces

- **Role requis** : ADMIN+
- **Route front-end** : `/admin/activity-logs`
- **Route API** : `/api/activity-logs`
- **Menu** : "Journal d'activite" remplace "Historique des scans" dans la sidebar

## API

### GET /api/activity-logs

Parametres de requete :

| Parametre | Type | Description |
|-----------|------|-------------|
| type | string | Type d'action ou groupe (registration, badge, scan, user, config) |
| userId | string | Filtrer par utilisateur |
| search | string | Recherche dans les details (nom, structure) |
| startDate | string (ISO) | Date de debut |
| endDate | string (ISO) | Date de fin |
| page | int | Numero de page (defaut: 1) |
| limit | int | Nombre par page (defaut: 30) |

## Page journal d'activite

- Tableau avec colonnes : date/heure, type (badge colore par famille), utilisateur, description, ressource
- Filtres : type (menu deroulant par groupe), utilisateur, recherche, plage de dates
- Pagination (30 par page)
- Vue responsive : tableau sur desktop, cartes sur mobile

Couleurs des badges par famille :
- Inscriptions : vert
- Badges : violet
- Scans : bleu
- Utilisateurs : orange
- Configuration : gris

## Fonction utilitaire

`logActivity()` dans `src/lib/activity-log.ts` :

```typescript
logActivity({
  type: ActivityType,
  userId?: string,
  targetId?: string,
  details?: object,
})
```

Appelee depuis chaque route API concernee. Ne lance pas d'erreur en cas d'echec (log silencieux pour ne pas bloquer l'action principale).

## Integration par route

| Route | Action | Type |
|-------|--------|------|
| POST /api/registrations | Inscription creee | REGISTRATION_CREATED |
| PATCH /api/registrations/[id] | Statut change | REGISTRATION_APPROVED / REJECTED |
| PATCH /api/registrations/[id] | Autres modifications | REGISTRATION_UPDATED |
| PATCH /api/registrations/[id] | Badge imprime | BADGE_PRINTED |
| PATCH /api/registrations/[id] | ALL ACCESS toggle | BADGE_ALL_ACCESS_TOGGLED |
| DELETE /api/registrations/[id] | Inscription supprimee | REGISTRATION_DELETED |
| POST /api/registrations/print | Batch impression | BADGE_BATCH_PRINTED |
| POST /api/scan | Badge scanne | BADGE_SCANNED |
| POST /api/users | Utilisateur cree | USER_CREATED |
| PATCH /api/users/[id] | Utilisateur modifie | USER_UPDATED |
| DELETE /api/users/[id] | Utilisateur supprime | USER_DELETED |
| POST /api/setup-password | Mot de passe defini | USER_PASSWORD_SET |
| NextAuth signIn callback | Connexion | USER_LOGIN |
| PUT /api/event | Evenement modifie | EVENT_UPDATED |
| PUT /api/settings | Parametres modifies | SETTINGS_UPDATED |
| POST /api/teams | Categorie creee | CATEGORY_CREATED |
| PATCH /api/teams/[id] | Categorie modifiee | CATEGORY_UPDATED |
| DELETE /api/teams/[id] | Categorie supprimee | CATEGORY_DELETED |
| POST /api/activity-logs | Badge exporte | BADGE_EXPORTED / BADGE_BATCH_EXPORTED |

## Suppressions

- Modele `ScanLog` supprime du schema Prisma
- `src/app/api/scan-logs/route.ts` supprime
- `src/app/admin/scan-history/page.tsx` supprime
- Lien "Historique des scans" remplace par "Journal d'activite" dans la sidebar

## Fichiers source

| Fichier | Role |
|---------|------|
| `prisma/schema.prisma` | Ajout ActivityLog + enum, suppression ScanLog |
| `src/lib/activity-log.ts` | Nouveau -- fonction logActivity() |
| `src/app/api/activity-logs/route.ts` | Nouveau -- GET avec filtres et pagination |
| `src/app/admin/activity-logs/page.tsx` | Nouveau -- page journal |
| `src/components/admin/Sidebar.tsx` | Modifie -- remplacement lien |
| `src/app/api/scan/route.ts` | Modifie -- utilise logActivity |
| Toutes les routes API listees ci-dessus | Modifiees -- ajout logActivity() |
| `src/app/api/scan-logs/route.ts` | Supprime |
| `src/app/admin/scan-history/page.tsx` | Supprime |
