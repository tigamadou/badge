# Scan QR

## Description fonctionnelle

Le systeme permet aux operateurs de scanner les QR codes des badges aux points de controle de la ceremonie. Le scan valide le badge en temps reel, affiche les informations du participant et enregistre automatiquement un journal de passage. Une page publique permet egalement a quiconque de verifier la validite d'un badge.

## Scanner (`/scan`)

### Acces

- **Role requis** : OPERATOR (et superieur)
- **Protection** : middleware Next.js (authentification) + verification de role dans l'API `/api/scan`

### Fonctionnement technique

- Bibliotheque : `html5-qrcode` (chargement client-side uniquement, lazy loading via import dynamique)
- Le composant `ScanPageClient` est charge dynamiquement via `ScanDynamic` pour eviter les erreurs SSR
- L'acces a la camera n'est demande qu'apres un geste utilisateur (tap sur un bouton), pour respecter les politiques des navigateurs mobiles
- Configuration camera : facingMode `environment` (camera arriere), 10 fps, zone de detection 250x250 px
- Apres un scan reussi, le scanner est immediatement stoppe pour eviter les declenchements en cascade (verrou `isProcessingRef`)

### Flux de scan

1. L'operateur accede a `/scan` (authentification requise)
2. Un ecran d'accueil invite a appuyer sur le bouton **« Autoriser la camera et scanner »**
3. Le navigateur affiche la demande d'autorisation camera ; en cas de refus, un message d'erreur explicite s'affiche
4. La camera s'active et le QR code du badge est detecte automatiquement
5. L'application envoie `POST /api/scan` avec l'identifiant decode (`registrationId`)
6. Le serveur enregistre un `ActivityLog` de type `BADGE_SCANNED` puis retourne les informations de l'inscription
7. Le resultat s'affiche en plein ecran :
   - **Fond vert** + croix verte : badge valide (inscription `APPROVED`)
   - **Fond rouge** + croix rouge : badge invalide (inscription `PENDING`, `REJECTED`, ou identifiant inconnu)
8. Un bouton **« Scanner un autre badge »** relance le scanner

### Gestion des erreurs camera

| Cas | Message affiche |
|-----|-----------------|
| Permission camera refusee | « Acces a la camera refuse. Veuillez autoriser l'acces dans les parametres du navigateur. » |
| Camera occupee par une autre application | « Impossible de demarrer la camera. Verifiez que la camera n'est pas utilisee par une autre application. » |
| Erreur reseau lors du POST `/api/scan` | « Erreur de connexion au serveur » |
| Badge inconnu (404) ou non approuve | Le message d'erreur retourne par l'API s'affiche en plein ecran rouge |

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

- Barre superieure fixe avec titre « Scanner » et nom de l'operateur connecte
- Bouton menu (icone hamburger) qui ouvre un overlay plein ecran avec liens vers :
  - Dashboard (`/admin`)
  - Inscriptions (`/admin/registrations`)
  - Badges (`/admin/badges`)
  - Scanner (page courante, mise en evidence)
  - Historique Scans (`/admin/scan-history`)
- Gestion d'erreur si la camera n'est pas accessible

## Historique des scans

Les scans sont enregistres dans le journal d'activite (type `BADGE_SCANNED`). L'historique est consultable depuis la page "Journal d'activite" (`/admin/activity-logs`) en filtrant par type "Scans". Voir [Journal d'activite](journal-activite.md).

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
| `src/app/admin/activity-logs/page.tsx` | Page journal d'activite (filtre scan) |
| `src/app/verify/[id]/page.tsx` | Page verification publique |
| `src/app/api/scan/route.ts` | Endpoint enregistrement scan |
| `src/app/api/activity-logs/route.ts` | Endpoint journal d'activite |
| `src/app/api/verify/[id]/route.ts` | Endpoint verification publique |
