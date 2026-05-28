# Gestion des inscriptions

## Description fonctionnelle

Les moderateurs et administrateurs gerent le cycle de vie des inscriptions : consultation, approbation, rejet, creation manuelle, edition apres validation/rejet et suppression. Chaque changement de statut declenche une notification par email au participant.

Le role `SUPER_ADMIN` n'a pas le droit de valider, rejeter, supprimer une inscription ni de marquer un badge comme imprime ; toutes les colonnes d'action de la page detail sont masquees pour lui. Les actions sont reservees aux roles `MODERATEUR` et superieurs (hors SUPER_ADMIN).

## Workflow des statuts

```
PENDING --> APPROVED --> Badge generable
   |            |
   |            +--> Lien d'edition (a la demande) --> PENDING
   |
   +-----> REJECTED (irreversible)
              |
              +--> editToken auto 48h --> PENDING (resoumission)
```

- `PENDING` : statut initial. Validation (`APPROVED`) ou rejet (`REJECTED`) possible.
- `APPROVED` : badge generable. Un moderateur peut envoyer un lien d'edition (action `send-edit-link`) pour permettre une correction ; l'inscription repasse en `PENDING` apres resoumission.
- `REJECTED` : irreversible (impossible de repasser directement en `APPROVED`). Un `editToken` est genere automatiquement (validite 48h) et un email contenant le lien d'edition est envoye au participant. L'inscrit peut modifier ses informations puis resoumettre, ce qui repasse l'inscription en `PENDING`.

## Fonctionnalites

### Liste des inscriptions (`/admin/registrations`)

- Tableau avec colonnes : nom, structure, categorie, date, statut
- Recherche textuelle par nom, prenom, email ou structure (parametre `search` de l'API)
- Filtre par statut : Tous, En attente, Valide, Rejete (parametre `status`)
- Filtre par categorie (parametre `teamId`, liste recuperee via `/api/teams?limit=100`)
- Pagination configurable (defaut 20 par page, max 100)
- Vue responsive : tableau sur desktop, cartes sur mobile
- Lien "Nouvelle inscription" vers le formulaire de creation manuelle

### Detail d'une inscription (`/admin/registrations/[id]`)

Mise en page deux colonnes (trois si des doublons sont detectes) :

**Colonne gauche -- Informations**
- Photo (avec initiales en fallback), nom, prenom, structure, categorie avec couleur, statut, date d'inscription
- Email, type et numero de piece d'identite, ID inscription
- Document d'identite (cliquable pour ouvrir en taille reelle)
- Motif et details du rejet si l'inscription est `REJECTED`
- Historique des soumissions (snapshots) lorsqu'il y a plusieurs versions

**Colonne droite -- Actions** (masquee pour SUPER_ADMIN)
- Statut `PENDING` : boutons "Valider" et "Rejeter". Le bouton "Rejeter" ouvre une modale avec une liste deroulante de motifs predefinis ("Photo non conforme", "Document d'identite illisible", "Document d'identite expire", "Informations incorrectes", "Doublon d'inscription", "Categorie non autorisee", "Autre") et un champ texte de details. Les actions sont desactivees tant que les informations de contact (email et telephone) ne sont pas configurees dans les parametres.
- Statut `APPROVED` : lien vers la page Badges et bouton "Envoyer un lien de modification" (action `send-edit-link`). L'inscrit recoit un email avec un lien valable 48h ; apres resoumission, l'inscription repasse en `PENDING`.
- Statut `REJECTED` : panneau "Lien de modification" affichant la date d'expiration du `editToken` courant, un bouton "Copier le lien", et un bouton "Renvoyer le lien de modification".
- Statut `REJECTED` : panneau "Bloquer cet email" (POST/DELETE `/api/registrations/[id]/block-email`) et panneau "Bloquer ce N de document" (POST/DELETE `/api/registrations/[id]/block-document`). Une fois bloque, l'email ou le numero de document ne pourra plus servir a soumettre ni a modifier une inscription -- les nouvelles tentatives sont silencieusement ignorees.

**Colonne supplementaire -- Doublons** (affichee si au moins un match)
- Liste des inscriptions similaires renvoyee par `GET /api/registrations/[id]/duplicates`.
- Six regles de detection (memes email, document, nom+prenom exacts, nom/prenom inverses, pattern email `prenom.nom@`, pattern email croise). Plus le nombre de raisons match est eleve, plus le risque de doublon est signale (bandeau amber/orange/rose selon 1 / 2 / 3+ matches).

### Creation manuelle (`/admin/registrations/new`)

- Reutilise `RegistrationForm` (meme composant que l'inscription publique).
- Pas de validation reCAPTCHA.
- Les fichiers sont uploades via `POST /api/upload` apres la creation de l'inscription, en utilisant l'identifiant reel ; les chemins sont ensuite poses via `PATCH /api/registrations/[id]`.
- Une categorie anonyme cree une inscription automatiquement approuvee, sans email envoye.
- Redirection vers `/admin/registrations` apres creation.

### Snapshots (historique des soumissions)

Un `SubmissionSnapshot` est cree :
- A la creation initiale (publique ou admin).
- A chaque resoumission via le lien de modification.

L'historique est affiche sur la page detail si plusieurs entrees existent, du plus recent au plus ancien.

## Regles metier

- Un email de notification est envoye au participant a chaque changement de statut (approbation ou rejet). En cas de rejet, le message inclut le motif, les details et le lien d'edition.
- La creation manuelle par un admin ne declenche pas de validation reCAPTCHA.
- Les categories `anonymous` sont automatiquement approuvees, sans envoi d'email.
- La suppression est definitive (pas de corbeille) et reservee aux moderateurs (refusee pour SUPER_ADMIN).
- L'ID de l'inscription est genere automatiquement et ne peut pas etre modifie.
- Une inscription `REJECTED` ne peut pas etre passee directement a `APPROVED` ; l'API renvoie 400 dans ce cas.
- Avant toute action declenchant un email (approbation, rejet, envoi de lien d'edition, marquage badge imprime), l'API verifie que les informations de contact (`contactEmail`, `contactPhone`) sont configurees ; sinon elle repond 400 avec un message d'erreur.

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/app/admin/registrations/page.tsx` | Liste, filtres, pagination |
| `src/app/admin/registrations/[id]/page.tsx` | Detail, actions, doublons, snapshots, blocages |
| `src/app/admin/registrations/new/page.tsx` | Formulaire creation manuelle |
| `src/app/api/registrations/route.ts` | GET liste, POST creation (incl. blocages, anonymes, reCAPTCHA) |
| `src/app/api/registrations/[id]/route.ts` | GET detail, PATCH (statut, ALL ACCESS, send-edit-link), DELETE |
| `src/app/api/registrations/[id]/block-email/route.ts` | POST/DELETE blocage email |
| `src/app/api/registrations/[id]/block-document/route.ts` | POST/DELETE blocage numero de document |
| `src/app/api/registrations/[id]/duplicates/route.ts` | GET detection des doublons (6 regles) |
| `src/app/api/registrations/resend-edit-link/route.ts` | POST renvoi public d'un lien d'edition |
| `src/app/api/edit-registration/[token]/route.ts` | GET/POST flux d'edition apres rejet/approbation |
| `src/app/api/edit-registration/[token]/resend/route.ts` | POST renouvellement du token expire |
| `src/app/edit-registration/[token]/page.tsx` | Page publique de modification d'inscription |
| `src/components/admin/RegistrationForm.tsx` | Composant formulaire reutilisable |
| `src/lib/mail.ts` | Notifications email (statut, lien d'edition, badge imprime) |
