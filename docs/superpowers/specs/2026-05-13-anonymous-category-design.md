# Catégorie Anonyme — Design Spec

## Contexte

Le système de badges d'investiture a besoin de supporter des badges "anonymes" — des badges qui n'affichent aucune information personnelle. Seuls l'entête de l'événement, le nom/couleur de la catégorie, le numéro de badge et le QR code sont visibles.

## Comportement

### Modèle Team — Nouveau champ `anonymous`

- Ajout de `anonymous Boolean @default(false)` sur le modèle `Team` dans Prisma
- Une catégorie marquée `anonymous: true` produit des badges sans informations personnelles
- Plusieurs catégories peuvent être anonymes simultanément

### Formulaire d'inscription public

- Les catégories avec `anonymous: true` sont **exclues** du dropdown de sélection
- Aucun utilisateur public ne peut s'inscrire dans une catégorie anonyme

### Création d'inscription (API)

- Seul un utilisateur authentifié (MODERATEUR+) peut inscrire dans une catégorie anonyme
- Tous les champs personnels deviennent **optionnels** : `lastName`, `firstName`, `email`, `structure`, `photo`, `idDocumentType`, `idDocumentNumber`, `idDocument`
- L'inscription est créée directement avec le statut `APPROVED`
- **Aucun email** n'est envoyé, même si un email est renseigné

### Badge PDF — Nouveau composant `BadgeDocumentAnonymous`

- Composant dédié, séparé de `BadgeDocument.tsx`
- Layout centré avec QR code plus gros
- Éléments affichés :
  - Entête événement (logo + titre)
  - Nom et couleur de la catégorie
  - Numéro de badge
  - QR code (centré, taille agrandie)
- Éléments **jamais** affichés : photo, nom, prénom, structure — même si ces données existent en base
- Le choix du composant (standard vs anonyme) se fait selon `team.anonymous`

### Formulaire admin (TeamForm)

- Ajout d'une checkbox "Catégorie anonyme" dans le formulaire de création/modification de catégorie

### Vues admin

- L'admin peut voir les informations personnelles stockées en base dans la page de détail d'une inscription anonyme
- La galerie de badges et l'export PDF utilisent le bon composant selon `team.anonymous`

## Fichiers impactés

| Zone | Fichiers |
|------|----------|
| Schema DB | `prisma/schema.prisma` |
| API Teams | `src/app/api/teams/route.ts`, `src/app/api/teams/[id]/route.ts` |
| API Registrations | `src/app/api/registrations/route.ts` |
| Formulaire public | `src/app/page.tsx` ou composant `RegistrationForm` |
| Formulaire admin catégorie | `src/components/admin/TeamForm.tsx` |
| Badge standard | `src/components/badge/BadgeDocument.tsx` (inchangé) |
| Badge anonyme | `src/components/badge/BadgeDocumentAnonymous.tsx` (nouveau) |
| Aperçu badge | `src/components/badge/BadgePreview.tsx` |
| Export batch | `src/components/badge/BadgeBatchExport.tsx` |
| Téléchargement badge | `src/components/badge/BadgeDownload.tsx` |
