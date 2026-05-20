# Spec : Rôle MODERATEUR

## Contexte

Le système actuel a 3 rôles : OPERATOR (1), ADMIN (2), SUPER_ADMIN (3). Il manque un rôle intermédiaire entre OPERATOR et ADMIN pour les modérateurs qui gèrent les inscriptions, badges et catégories sans accéder à la configuration de l'événement ni aux paramètres système.

## Nouvelle hiérarchie

```
OPERATOR (1) → MODERATEUR (2) → ADMIN (3) → SUPER_ADMIN (4)
```

## Accès du MODERATEUR

| Section | Accès | Actions |
|---------|-------|---------|
| Dashboard | Oui, sans KPIs utilisateurs | Inscriptions + badges + scans |
| Inscriptions | Complet | Approuver, rejeter, envoyer lien d'édition, bloquer email, supprimer |
| Badges | Complet | Marquer imprimé, toggle ALL ACCESS, impression batch |
| Scanner | Complet | Scanner QR codes |
| Catégories | Complet | CRUD |
| Événement | Non | — |
| Paramètres | Non | — |
| Utilisateurs | Non | — |
| Journal d'activité | Non | — |

## Modifications

### 1. Prisma schema (`prisma/schema.prisma`)

Ajouter `MODERATEUR` à l'enum `Role` entre OPERATOR et ADMIN.

### 2. Hiérarchie des rôles (`src/lib/auth.ts`)

```ts
const ROLE_HIERARCHY: Record<string, number> = {
  OPERATOR: 1,
  MODERATEUR: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};
```

Mettre à jour les copies dupliquées dans `Sidebar.tsx` et `admin/page.tsx`.

### 3. Sidebar (`src/components/admin/Sidebar.tsx`)

Ajuster les `minRole` des items de navigation :

| Item | Ancien minRole | Nouveau minRole |
|------|---------------|----------------|
| Dashboard | OPERATOR | OPERATOR |
| Inscriptions | ADMIN | MODERATEUR |
| Badges | ADMIN | MODERATEUR |
| Scanner | OPERATOR | OPERATOR |
| Catégories | ADMIN | MODERATEUR |
| Événement | ADMIN | ADMIN |
| Paramètres | ADMIN | ADMIN |
| Utilisateurs | SUPER_ADMIN | SUPER_ADMIN |
| Journal d'activité | ADMIN | ADMIN |

### 4. Dashboard (`src/app/admin/page.tsx`)

- Les KPIs inscriptions, badges et scans : visibles pour `MODERATEUR+` (checkRole >= MODERATEUR)
- Les KPIs utilisateurs : visibles uniquement pour `ADMIN+` (checkRole >= ADMIN)
- OPERATOR : uniquement ses propres stats de scan (inchangé)

### 5. Routes API

Routes qui passent de `checkRole(..., "ADMIN")` à `checkRole(..., "MODERATEUR")` :

- `GET /api/registrations`
- `GET/PATCH/DELETE /api/registrations/[id]`
- `POST/DELETE /api/registrations/[id]/block-email`
- `POST /api/registrations/print`
- `GET/POST /api/teams` (POST seulement, GET est public)
- `PATCH/DELETE /api/teams/[id]`

Routes qui restent à `checkRole(..., "ADMIN")` :

- `PUT /api/event`
- `GET/PUT/POST /api/settings`
- `GET /api/activity-logs`

Route inchangée :

- `POST /api/scan` — reste à `checkRole(..., "OPERATOR")`

### 6. UserForm (`src/components/admin/UserForm.tsx`)

Ajouter `MODERATEUR` comme option dans le select de rôle (entre OPERATOR et ADMIN).

### 7. Migration Prisma

Générer et appliquer la migration pour le nouvel enum.

### 8. Seed (optionnel)

Ajouter un utilisateur MODERATEUR de démo dans le seed.

## Ce qui ne change PAS

- La restriction SUPER_ADMIN sur les actions opérationnelles
- Le système d'auth (middleware, JWT, session)
- Les pages publiques
- La structure de la base de données (hors enum Role)
