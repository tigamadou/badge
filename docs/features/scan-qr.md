# Scan QR

## Description fonctionnelle

Le systeme permet aux operateurs de scanner les QR codes des badges aux points de controle de la ceremonie. Le scan valide le badge en temps reel, affiche les informations du participant et enregistre automatiquement un journal de passage. Une page publique permet egalement a quiconque de verifier la validite d'un badge.

## Scanner (`/scan`)

### Acces

- **Role requis** : OPERATOR (et superieur)
- **Protection** : middleware Next.js

### Fonctionnement technique

- Bibliotheque : `html5-qrcode` (chargement client-side uniquement, lazy loading)
- Le composant `ScanPageClient` est charge dynamiquement via `ScanDynamic` pour eviter les erreurs SSR
- Demande la permission camera au navigateur

### Flux de scan

1. L'operateur accede a `/scan`
2. La camera s'active apres autorisation
3. Le QR code du badge est detecte automatiquement
4. L'application envoie `POST /api/scan` avec l'ID d'inscription
5. Le serveur cree un `ScanLog` et retourne les informations
6. Le resultat s'affiche a l'ecran :
   - **Fond vert** : badge valide (inscription approuvee)
   - **Fond rouge** : badge invalide (inscription non trouvee ou non approuvee)

### Informations affichees

- Photo du participant
- Nom (en majuscules) et prenom
- Structure
- Categorie avec indicateur de couleur
- Statut de l'inscription
- Mention "ALL ACCESS" si applicable
- Identifiant du badge
- Heure du scan

### Interface

- Nom de l'operateur affiche dans le header
- Menu de navigation avec liens vers les autres sections
- Gestion d'erreur si la camera n'est pas accessible

## Historique des scans (`/admin/scan-history`)

### Acces

- **Role requis** : OPERATOR
- **Route** : `/admin/scan-history`

### Fonctionnalites

- Liste paginee (20 entrees par page)
- Colonnes : date/heure, operateur, participant, categorie
- Filtres :
  - Par operateur (menu deroulant)
  - Par nom ou structure du participant (recherche textuelle)
  - Par plage de dates (date debut / date fin)
- Statistique : nombre total de scans
- Pagination : boutons Precedent / Suivant
- Vue responsive : tableau sur desktop, cartes sur mobile

## Verification publique (`/verify/[id]`)

### Acces

- **Authentification** : non requise (public)
- **Route** : `/verify/<identifiant-badge>`

### Fonctionnement

Cette page permet a quiconque ayant l'identifiant d'un badge de verifier sa validite. Elle affiche :
- Photo du participant
- Nom, structure, categorie
- Statut de l'inscription (PENDING, APPROVED, REJECTED)
- Informations de l'evenement
- Identifiant du badge

L'API `GET /api/verify/[id]` retourne les donnees sans authentification.

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/app/scan/page.tsx` | Page scanner (entry point) |
| `src/app/scan/ScanPageClient.tsx` | Composant scanner client-side |
| `src/app/scan/ScanDynamic.tsx` | Chargement dynamique (pas de SSR) |
| `src/app/admin/scan-history/page.tsx` | Page historique des scans |
| `src/app/verify/[id]/page.tsx` | Page verification publique |
| `src/app/api/scan/route.ts` | Endpoint enregistrement scan |
| `src/app/api/scan-logs/route.ts` | Endpoint historique scans |
| `src/app/api/verify/[id]/route.ts` | Endpoint verification publique |
