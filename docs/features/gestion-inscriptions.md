# Gestion des inscriptions

## Description fonctionnelle

Les administrateurs et operateurs gerent le cycle de vie des inscriptions : consultation, approbation, rejet, creation manuelle et suppression. Chaque changement de statut declenche une notification par email au participant.

## Workflow des statuts

```
PENDING ──> APPROVED ──> Badge generable
   │                       │
   └──> REJECTED           └──> Badge imprimable
```

Une inscription est creee avec le statut `PENDING`. Un administrateur peut l'approuver (`APPROVED`) ou la rejeter (`REJECTED`). Seules les inscriptions approuvees peuvent avoir un badge genere et imprime.

## Fonctionnalites

### Liste des inscriptions (`/admin/registrations`)

- Tableau avec colonnes : nom, email, structure, categorie, statut, date
- Recherche textuelle par nom, email ou structure
- Filtre par statut : En attente, Approuve, Rejete
- Filtre par categorie
- Boutons d'action rapide sur les inscriptions en attente : Approuver / Rejeter
- Lien vers la page de detail
- Vue responsive : tableau sur desktop, cartes sur mobile

### Detail d'une inscription (`/admin/registrations/[id]`)

- Affichage complet : photo (avec initiales en fallback), nom, prenom, email, structure, categorie avec couleur, type et numero de piece d'identite, document d'identite (cliquable pour agrandir), date de creation, statut
- Boutons de changement de statut (Approuver / Rejeter)
- Lien vers la page badge (si approuve)
- Suppression de l'inscription

### Creation manuelle (`/admin/registrations/new`)

- Meme formulaire que l'inscription publique
- Pas de validation reCAPTCHA
- Les fichiers sont uploades via le meme endpoint `/api/upload`
- Redirection vers la liste apres creation

## Regles metier

- Un email de notification est envoye au participant a chaque changement de statut (approbation ou rejet)
- La creation manuelle par un admin ne declenche pas de validation reCAPTCHA
- La suppression est definitive (pas de corbeille)
- L'ID de l'inscription est genere automatiquement et ne peut pas etre modifie

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/app/admin/registrations/page.tsx` | Liste des inscriptions |
| `src/app/admin/registrations/[id]/page.tsx` | Detail inscription |
| `src/app/admin/registrations/new/page.tsx` | Formulaire creation |
| `src/app/api/registrations/route.ts` | GET liste, POST creation |
| `src/app/api/registrations/[id]/route.ts` | GET detail, PATCH modif, DELETE suppression |
| `src/components/admin/RegistrationForm.tsx` | Composant formulaire |
| `src/lib/mail.ts` | Notifications email |
