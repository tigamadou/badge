# Design : Evolutions Badge — Style, ID, Catégories, ALL ACCESS

**Date** : 2026-05-06
**Branche** : development

## Contexte

Application de gestion de badges pour la cérémonie d'investiture. Trois évolutions demandées :
1. Mise à jour du style du badge
2. Nouvelle logique de génération d'ID + renommage "Équipes" → "Catégories" dans le front
3. Ajout du paramètre ALL_ACCESS_GRANTED

## 1. Modèle de données

### Modifications Prisma

**Team** — ajout :
- `number Int @unique` — chiffre unique (1-9), utilisé dans la génération d'ID

**Registration** — ajout :
- `allAccessGranted Boolean @default(false)`

### Génération d'ID

Format : `[numCatégorie][AAMMJJ][XX][numCatégorie][NNN]`

| Segment | Description | Exemple |
|---------|-------------|---------|
| `numCatégorie` | `team.number` (1 chiffre) | `1` |
| `AAMMJJ` | Date de l'événement (année 2 chiffres, mois, jour) | `260524` |
| `XX` | 2 chiffres aléatoires (00-99) | `00` |
| `numCatégorie` | Répétition de `team.number` | `1` |
| `NNN` | Compteur auto-incrémenté par catégorie (COUNT des inscriptions du teamId + 1, formaté sur 3 chiffres) | `100` |

Exemple complet : `1260524001100`

La fonction `generateId` dans `src/lib/generate-id.ts` sera réécrite. Elle nécessitera désormais le `team.number` et le count des inscriptions existantes pour la catégorie.

## 2. Renommage front "Équipes" → "Catégories"

### Routes front
- `/admin/teams` → `/admin/categories` (renommer le dossier `src/app/admin/teams` → `src/app/admin/categories`)

### Labels modifiés
- Sidebar : "Équipes" → "Catégories"
- Page catégories : titre "Catégories", bouton "Nouvelle catégorie"
- Modal suppression : "Supprimer la catégorie ?"
- Formulaire inscription (`RegistrationForm.tsx`) : label "Équipe" → "Catégorie"
- Page détail inscription : label équipe → catégorie

### Ce qui ne change PAS
- Routes API : `/api/teams`, `/api/teams/[id]`
- Modèle Prisma : `Team`
- Noms de composants internes (TeamForm, etc.)

### Nouveau champ dans TeamForm
- Champ "Numéro" (input numérique 1-9, requis, unique) ajouté au formulaire de création/édition de catégorie

## 3. Nouveau style du badge (BadgeDocument)

Layout restructuré selon `badge_2.JPG` :

### En-tête (fond blanc, ~40% hauteur)
- Logo centré en haut
- Titre événement en gras bleu foncé, centré
- Date/lieu en bleu plus clair, centré

### Zone centrale (fond couleur catégorie, ~50% hauteur)
- Nom de la catégorie en très gros, gras, blanc, majuscules, centré en haut
- Disposition horizontale en dessous :
  - ID vertical rotaté -90° sur le bord gauche
  - Photo (carré gris si absente)
  - À droite de la photo : nom complet en gras blanc + séparateur horizontal + structure en blanc
- QR code en bas à droite de la zone

### Dimensions
Inchangées : 100mm x 140mm

## 4. Toggle ALL_ACCESS_GRANTED

### UI — Page détail inscription
- Visible uniquement quand `status === "APPROVED"` ET `badgePrinted === false`
- Bouton toggle : "Activer ALL ACCESS" / "Désactiver ALL ACCESS"

### API
- Route PATCH existante `/api/registrations/[id]` avec `{ allAccessGranted: true/false }`
- Pas de nouvelle route

### Impact sur le badge
- `BadgeDocument` reçoit une prop `allAccessGranted: boolean`
- Si `true` : bande rouge en bas (~10% hauteur) avec texte "ALL ACCESS" en gras blanc majuscules
- La zone centrale se réduit légèrement pour faire place à la bande

## Approche choisie

**Approche B — Renommage front uniquement + évolutions ciblées**
- Le modèle Prisma `Team` reste intact
- Les routes API restent `/api/teams`
- Seuls les labels, routes front et composants visibles changent
