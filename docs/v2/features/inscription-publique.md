# Inscription publique scopée

## Description fonctionnelle

L'inscription publique permet à un participant non authentifié de s'inscrire à un événement via un formulaire web, en accédant à l'URL `https://badge.app/e/[slug]`. La page est entièrement contextualisée par l'événement : logo, titre, catégories, contact, reCAPTCHA, expéditeur SMTP — tout est résolu en cascade depuis `Event → Org → Platform`.

Cette feature couvre aussi les flux post-inscription côté participant :

- Page succès
- Vérification publique du badge (`/verify/[badgeId]`)
- Édition après rejet (`/edit-registration/[token]`)

## Périmètre

Inclus :

- Pages `/e/[slug]`, `/e/[slug]/success`
- Pages `/verify/[badgeId]`, `/edit-registration/[token]`
- Routes API publiques (`/api/public/events/[slug]`, `/api/public/events/[slug]/registrations`, `/api/public/verify/[badgeId]`, `/api/public/edit-registration/[token]`)
- Upload de fichiers contextualisé (`/api/upload` avec scope event public)
- Composants : `PublicEventLayout`, `PublicRegistrationForm`, `BadgeVerifyPage`, `EditRegistrationPage`

Exclu :

- Templates email (spec 6)
- Formulaire de création manuelle par admin (spec 4)
- Génération du PDF badge (spec 4)

## Pages

### `/e/[slug]` — Formulaire d'inscription

Server Component qui :

1. Charge `Event` par slug (incluant `Organization`)
2. Vérifie `!event.archived && event.registrationOpen`
3. Résout les settings (`resolvePublicSettings(eventId)`)
4. Charge les `Category` de l'event
5. Rend `PublicRegistrationForm` avec ces données

Si event introuvable ou inscription fermée → page 404 ou message "Inscriptions fermées" avec contact (résolu depuis settings).

Champs du formulaire :

- Email, nom, prénom, structure
- Sélection catégorie (radio cards avec couleurs)
- Type de document d'identité + numéro
- Upload photo (image, max 5 Mo, JPEG/PNG/WebP)
- Upload document (image ou PDF, max 5 Mo)
- reCAPTCHA v3 (si activé dans settings résolus)

Quota inscriptions : si `event.organization.quotaMaxRegistrations` atteint, afficher "Inscriptions complètes" et bloquer la soumission.

### `/e/[slug]/success`

Affiche un message de confirmation contextualisé :

- "Votre inscription à [titre event] a bien été enregistrée."
- "Un email de confirmation a été envoyé à [email]."
- Coordonnées de contact (résolution cascade)
- Lien retour vers le site organisateur (configurable dans EventSettings ? — pour la v2 on ne propose pas)

### `/verify/[badgeId]`

Vérification publique d'un badge (utilisée par le QR code scanné par un appareil quelconque, pas seulement le scanner officiel).

Route globale (pas scope event) : on retrouve l'event via `Registration.eventId`.

Affiche :

- Statut du badge (Valide / Non valide)
- Titre de l'event
- Nom/prénom du participant (sauf si la `Category.anonymous=true` → masqué)
- Catégorie (avec couleur)
- Date de l'event

Si `Registration.status != APPROVED` ou `!badgePrinted` → "Badge non valide" sans détail.

### `/edit-registration/[token]`

Page d'édition par le participant après rejet/approbation.

Server Component qui :

1. Valide le token (`editToken`, `editTokenExpiresAt > now`)
2. Charge la Registration + son Event + Categories
3. Rend `EditRegistrationPage`

Formulaire identique à `/e/[slug]` mais pré-rempli. Soumission :

- Sauvegarde un `SubmissionSnapshot` de l'état précédent
- Met à jour la Registration
- Status remis à `PENDING`, `editToken` effacé
- Activity log `REGISTRATION_RESUBMITTED`
- Email "Votre inscription a été resoumise"

## Routes API

```
GET    /api/public/events/[slug]                       → infos event + categories + settings publics
POST   /api/public/events/[slug]/registrations         → création inscription publique
                                                         body: photoToken, idDocumentToken (tokens upload)
                                                         + données formulaire + recaptchaToken si activé
GET    /api/public/verify/[badgeId]                    → vérification (selon visibilité catégorie)
GET    /api/public/edit-registration/[token]           → données pré-remplies + categories
POST   /api/public/edit-registration/[token]           → resoumission
POST   /api/public/edit-registration/[token]/resend    → renvoyer un editToken si expiré (cooldown 60s)
POST   /api/upload?context=event:[slug]                → upload sans auth, retourne un upload token signé
                                                         (lié à eventId + expiration courte 1h)
```

**Upload sécurisé** : `/api/upload?context=event:[slug]` vérifie que l'event est ouvert aux inscriptions, applique la limite 5 Mo, retourne un token signé court-vivant. La création de l'inscription consomme ce token pour matérialiser le fichier dans `uploads/events/[eventId]/photos/...` ou `/idDocuments/...`. Ce mécanisme évite les uploads orphelins.

## Composants

### `PublicEventLayout`

Layout commun pour `/e/*` et `/verify/*` et `/edit-registration/*` :

- Logo event (résolu depuis `event.logo` via `/api/files/[...path]`)
- Titre event + date + lieu
- Footer : contact résolu (email + tél) + mentions "Propulsé par Badge"

### `PublicRegistrationForm` (Client Component)

- Validation côté client (Zod)
- Upload de fichiers en deux temps (upload → token → submit)
- reCAPTCHA conditionnel (selon settings résolus)
- Désactivation soumission si formulaire invalide
- Affichage des erreurs par champ

### `BadgeVerifyPage` (Server Component)

Page sobre, rapide, sans JS lourd.

### `EditRegistrationPage` (Client Component)

Comme `PublicRegistrationForm` mais avec donnée initiale, et avec un encart "Votre inscription précédente a été rejetée : [motif]".

## Cascade des settings (rappel)

Quand on rend `/e/[slug]`, le résolveur charge :

```
1. EventSettings (table) — override
2. OrgSettings (table) — override
3. PlatformSettings (table) — défaut
```

Pour chaque clé : premier non-null gagne. Les clés publiques (sans secret) :

- `smtpFrom` (pour préparer l'expéditeur de la confirmation)
- `contactEmail`, `contactPhone` (footer)
- `recaptchaEnabled`, `recaptchaSiteKey` (formulaire)

## Critères d'acceptation

1. `/e/[slug-inexistant]` → 404 avec page d'erreur sobre.
2. `/e/[slug-event-archived]` → page "Inscriptions fermées".
3. `/e/[slug]` avec `registrationOpen=false` → page "Inscriptions fermées".
4. Un participant peut s'inscrire avec reCAPTCHA activé (clé site résolue depuis settings cascade).
5. La création échoue (HTTP 409) si email ou document est bloqué pour cet event.
6. La création échoue (HTTP 429) si quota atteint, avec message "Inscriptions complètes".
7. L'email de confirmation utilise l'expéditeur SMTP résolu en cascade.
8. `/verify/[badgeId]` d'un badge approuvé+imprimé affiche les infos (sauf si catégorie anonyme : masque nom).
9. `/verify/[badgeId]` d'un badge PENDING/REJECTED affiche "Badge non valide".
10. `/edit-registration/[token]` avec token expiré redirige vers une page "Lien expiré" avec bouton "Demander un nouveau lien".
11. Soumission d'une édition crée un `SubmissionSnapshot` et remet le statut à PENDING.
12. Upload d'un fichier > 5 Mo refuse avec HTTP 413.
13. Upload d'un type non autorisé refuse avec HTTP 415.

## Sécurité

- Pas d'authentification mais reCAPTCHA en option (configurable par org/event)
- Rate limit par IP sur `/api/public/*` : implémentation in-memory par instance pour MVP (table `Map<ip, { count, resetAt }>` avec fenêtre 1 minute, max 10 requêtes). Migration vers Redis si scaling horizontal.
- Tokens éphémères pour les uploads (1h)
- Tokens d'édition (`editToken`) : UUID v4, single-use, 48h, hashés en BDD ? Proposition : stocker en clair (consistant avec v1) mais non listables — vérifier le seuil de risque
- `editToken` n'est jamais exposé dans les réponses API (uniquement envoyé par email)

## Dépendances

- Spec 1 (Multi-tenancy & RBAC) : modèles, résolveur de settings
- Spec 6 (Emails) : confirmation, rejet, lien édition, badge imprimé
- Spec 4 (Event) : `BadgeDocument` réutilisé pour la page badge (mais c'est l'admin qui imprime, pas le public)
