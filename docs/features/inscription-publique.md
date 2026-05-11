# Inscription publique

## Description fonctionnelle

La page d'accueil de l'application sert de point d'entree pour les participants souhaitant s'inscrire a la ceremonie. Elle affiche les informations de l'evenement (titre, lieu, date, logo) et un formulaire d'inscription. Une fois le formulaire soumis, le participant recoit un email de confirmation et est redirige vers une page de succes.

L'inscription est creee avec le statut PENDING et doit etre approuvee par un administrateur avant que le badge puisse etre genere.

## Flux utilisateur

1. Le visiteur accede a la page d'accueil `/`
2. Les informations de l'evenement sont affichees en haut de page
3. Le visiteur remplit le formulaire d'inscription
4. Les fichiers (photo, document) sont uploades individuellement via `POST /api/upload`
5. Le formulaire complet est soumis via `POST /api/registrations` avec le token reCAPTCHA
6. Un email de confirmation est envoye au participant
7. Le visiteur est redirige vers `/register/success`

## Champs du formulaire

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| Nom | texte | oui | Nom de famille |
| Prenom | texte | oui | Prenom |
| Email | email | oui | Adresse email |
| Structure | texte | oui | Organisation ou institution |
| Categorie | select | oui | Categorie de participation (chargee depuis l'API) |
| Type de piece d'identite | texte | oui | CNI, passeport, etc. |
| Numero de piece | texte | oui | Numero du document |
| Photo | fichier | oui | Photo d'identite du participant |
| Document d'identite | fichier | oui | Scan ou photo de la piece d'identite |

## Regles metier

- La validation reCAPTCHA v3 est obligatoire pour les inscriptions publiques (cle site + cle secrete configurees en variables d'environnement)
- Les fichiers uploades sont valides : taille max 5 Mo, types JPEG/PNG/WebP/PDF
- L'ID d'inscription est genere automatiquement selon le format base sur la categorie et la date
- L'inscription est creee avec `status: PENDING`
- Un email de confirmation est envoye via la fonction `sendRegistrationConfirmation()`

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/app/page.tsx` | Page d'accueil avec formulaire |
| `src/app/register/success/page.tsx` | Page de confirmation |
| `src/app/api/registrations/route.ts` | Endpoint creation inscription |
| `src/app/api/upload/route.ts` | Endpoint upload fichiers |
| `src/lib/generate-id.ts` | Generation de l'identifiant |
| `src/lib/mail.ts` | Envoi email de confirmation |
