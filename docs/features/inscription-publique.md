# Inscription publique

## Description fonctionnelle

La page d'accueil de l'application sert de point d'entree pour les participants souhaitant s'inscrire a la ceremonie. Elle affiche les informations de l'evenement (titre, lieu, date, logo) et un formulaire d'inscription. Une fois le formulaire soumis, le participant recoit un email de confirmation et est redirige vers une page de succes.

L'inscription est creee avec le statut PENDING et doit etre approuvee par un administrateur avant que le badge puisse etre genere.

## Activation des inscriptions publiques

Les inscriptions publiques peuvent etre ouvertes ou fermees globalement via le drapeau `registrationOpen` du modele Event (configurable depuis `/admin/event` par un SUPER_ADMIN, voir aussi `docs/features/configuration-evenement.md`).

- Si `registrationOpen` est `false`, la page d'accueil affiche un message "Inscriptions fermees" a la place du formulaire et l'endpoint `POST /api/registrations` retourne 403 pour les requetes non authentifiees.
- Les utilisateurs authentifies (admin/moderateur) ne sont jamais bloques par ce drapeau et peuvent toujours creer des inscriptions depuis `/admin/registrations/new`.

## Flux utilisateur

1. Le visiteur accede a la page d'accueil `/`
2. La page recupere `/api/event` (informations + drapeau `registrationOpen`) et `/api/settings` (configuration reCAPTCHA)
3. Si les inscriptions sont fermees, un ecran "Inscriptions fermees" est affiche et le flux s'arrete
4. Sinon, les informations de l'evenement sont affichees en haut de page avec le formulaire d'inscription
5. Le visiteur remplit le formulaire ; les categories proposees excluent celles marquees `anonymous`
6. Les fichiers (photo, document) sont uploades individuellement via `POST /api/upload` avec un identifiant temporaire (UUID cote client) puis stockes sous `photos/{id}.{ext}` et `documents/{id}.{ext}`
7. Le formulaire complet est soumis via `POST /api/registrations` avec le token reCAPTCHA si active
8. Un email de confirmation est envoye au participant
9. Le visiteur est redirige vers `/register/success`

Si l'API retourne 409 avec `canResend: true` (cas d'une inscription rejetee precedente non bloquee), l'interface propose un bouton "Recevoir un lien de modification" qui appelle `POST /api/registrations/resend-edit-link`.

## Champs du formulaire

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| Nom | texte | oui | Nom de famille |
| Prenom | texte | oui | Prenom |
| Email | email | oui | Adresse email |
| Structure | texte | oui | Organisation ou institution |
| Categorie | select | oui | Categorie de participation (chargee depuis `/api/teams?excludeAnonymous=true`) |
| Type de piece d'identite | texte | oui | CNI, passeport, etc. |
| Numero de piece | texte | oui | Numero du document |
| Photo | fichier | oui | Photo d'identite du participant |
| Document d'identite | fichier | oui | Scan ou photo de la piece d'identite |

## Regles metier

- Le drapeau `registrationOpen` de l'evenement controle l'ouverture publique du formulaire (voir section dediee).
- La validation reCAPTCHA v3 est appliquee uniquement si elle est activee dans les parametres (`settings.recaptchaEnabled`). La cle site et la cle secrete sont stockees en base. Si l'option n'est pas activee, aucun token n'est exige.
- Les fichiers uploades sont valides : taille max 5 Mo, types JPEG/PNG/WebP (photo) et JPEG/PNG/WebP/PDF (document d'identite).
- Tous les champs sont requis cote serveur pour une categorie non anonyme (photo et document inclus). Une categorie anonyme est reservee aux moderateurs (voir section "Inscriptions anonymes" plus bas).
- L'ID d'inscription est genere automatiquement selon le format base sur le dernier chiffre de la categorie, la date et un compteur sequentiel (voir `docs/features/badges.md`).
- L'inscription est creee avec `status: PENDING`.
- Un email de confirmation est envoye via `sendRegistrationConfirmation()` (sauf pour les categories anonymes).

### Blocage des doublons et des listes noires

Avant la creation, l'API verifie :

1. La presence de l'email dans `BlockedEmail` ou du numero de document dans `BlockedDocument`. En cas de correspondance, la requete renvoie un 201 factice (sans creer l'inscription) pour ne pas reveler l'existence du blocage.
2. L'unicite de l'email parmi toutes les inscriptions existantes :
   - Statut `PENDING` : 409 "Une inscription est deja en cours de traitement pour cette adresse email."
   - Statut `APPROVED` : 409 "Une inscription validee existe deja pour cette adresse email."
   - Statut `REJECTED` non bloque : 409 "Votre inscription a ete rejetee. Vous pouvez demander un lien pour la modifier." avec `canResend: true`.
3. L'unicite du numero de document selon la meme logique.

### Inscriptions anonymes

Les categories marquees `anonymous` sont reservees aux moderateurs et sont automatiquement approuvees, sans envoi d'email. Elles ne sont pas exposees dans le selecteur du formulaire public (`excludeAnonymous=true`).

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/app/page.tsx` | Page d'accueil avec formulaire et detection du drapeau `registrationOpen` |
| `src/app/register/success/page.tsx` | Page de confirmation |
| `src/components/admin/RegistrationForm.tsx` | Formulaire reutilise (public, admin, edition) |
| `src/app/api/registrations/route.ts` | Endpoint creation inscription (incl. CAPTCHA, blocage, anonymes) |
| `src/app/api/registrations/resend-edit-link/route.ts` | Renvoi d'un lien d'edition pour une inscription rejetee |
| `src/app/api/upload/route.ts` | Endpoint upload fichiers |
| `src/lib/generate-id.ts` | Generation de l'identifiant |
| `src/lib/mail.ts` | Envoi email de confirmation |
