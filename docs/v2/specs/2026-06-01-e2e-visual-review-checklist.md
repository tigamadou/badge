# Checklist de revue visuelle manuelle — Badge v2 (2026-06-01)

> **Statut** : checklist opérationnelle
> **Spec associée** : `2026-06-01-e2e-coverage-design.md`
> **Plan associé** : `../plans/2026-06-01-v2-13-e2e-coverage.md`

## Pourquoi cette checklist

Playwright vérifie **le comportement fonctionnel** : la page charge, les actions s'exécutent, les effets de bord sont là. Il ne vérifie **pas** :

- Alignement, espacements, hiérarchie visuelle.
- Lisibilité des couleurs, contraste accessible.
- Cohérence typographique entre pages.
- Comportement responsive (mobile, tablet, desktop).
- États vides (premier accès, aucune donnée) vs pleins vs en erreur.
- Affichage du dark mode si applicable.
- Fluidité d'animation et transitions.
- Cohérence des libellés en français (accents, vouvoiement, formes verbales).

Cette checklist liste page par page **ce qu'il faut regarder à l'œil** après chaque lot de specs implémentées et avant toute release.

## Conventions

Chaque page se vérifie sur **3 viewports** :

| Viewport | Largeur | Navigateur recommandé |
|---|---|---|
| Mobile | 375 px (iPhone SE) | Chrome DevTools device mode |
| Tablet | 768 px (iPad portrait) | idem |
| Desktop | 1440 px | navigateur natif |

Chaque page se vérifie sur **3 états** :

| État | Comment l'obtenir |
|---|---|
| Vide | Tableau / liste sans donnée (entité fraîchement créée) |
| Chargé | État typique avec quelques entrées |
| Erreur | Forcer une erreur (network throttle, ID inexistant, action refusée) |

Chaque page se vérifie sur **les rôles concernés** : on confirme que les éléments réservés à un rôle sont effectivement absents pour les autres (cohérence visuelle, pas juste fonctionnelle).

**Comment cocher** : ouvrir un PR / commit `chore(visual-review): YYYY-MM-DD` qui met à jour cette checklist en mettant `[x]` sur les lignes vérifiées et en notant les bugs trouvés dans la colonne "Notes". Les bugs vont dans `docs/v2/specs/2026-06-01-e2e-visual-findings.md`.

---

## Conventions de libellés français à vérifier

| Convention | Exemple correct | Erreur fréquente |
|---|---|---|
| Vouvoiement systématique | « Votre profil », « Vous êtes connecté » | « Ton profil » |
| Accents préservés | « créé », « événement », « inscriptions » | « cree », « evenement » |
| Apostrophe typo | « l'événement » | « l'evenement » |
| Majuscule accentuée | « À propos », « Événement » | « A propos », « Evenement » |
| Espaces insécables | « 5 Mo », « 12 €», « N° 42 » | espace simple devant unité |
| Boutons en infinitif ou impératif court | « Créer », « Approuver », « Imprimer » | mixtures « Création », « Approuve » |
| Messages d'erreur courtois | « Cette adresse e-mail est déjà utilisée. » | « Email invalid » |

---

## Espace public / auth / participant

### `/` (accueil)

| Élément | Vide | Chargé | Erreur | Mobile | Tablet | Desktop | Notes |
|---|:-:|:-:|:-:|:-:|:-:|:-:|---|
| Logo et CTA login | — | [ ] | — | [ ] | [ ] | [ ] | |
| Redirection auto si connecté | — | [ ] | — | [ ] | [ ] | [ ] | |

### `/login`

| Élément | Vide | Chargé | Erreur | Mobile | Tablet | Desktop | Notes |
|---|:-:|:-:|:-:|:-:|:-:|:-:|---|
| Formulaire centré | [ ] | — | — | [ ] | [ ] | [ ] | |
| Message d'erreur "Email ou mot de passe incorrect" | — | — | [ ] | [ ] | [ ] | [ ] | |
| Liens "Mot de passe oublié" / "Créer un compte" | [ ] | — | — | [ ] | [ ] | [ ] | |

### `/register`

| Élément | Vide | Rempli | Erreur | Mobile | Tablet | Desktop | Notes |
|---|:-:|:-:|:-:|:-:|:-:|:-:|---|
| Formulaire complet visible sans scroll (desktop) | [ ] | — | — | — | [ ] | [ ] | |
| Critères mot de passe lisibles | [ ] | — | — | [ ] | [ ] | [ ] | |
| Affichage reCAPTCHA si activé | [ ] | — | — | [ ] | [ ] | [ ] | |
| Message "Email déjà utilisé" en français | — | — | [ ] | [ ] | [ ] | [ ] | |

### `/register/success`, `/forgot-password`, `/reset-password/[token]`, `/setup-password`, `/verify-email/[token]`

| Élément | À vérifier | Mobile | Tablet | Desktop | Notes |
|---|---|:-:|:-:|:-:|---|
| Confirmation lisible, lien vers `/login` clair | [ ] | [ ] | [ ] | [ ] | |
| Affichage en cas de token expiré | [ ] | [ ] | [ ] | [ ] | |
| Affichage en cas de token déjà utilisé | [ ] | [ ] | [ ] | [ ] | |

### `/select` (sélection org après login multi-org)

| Élément | Vide (1 org) | Plusieurs orgs | Notes |
|---|:-:|:-:|---|
| Affichage des orgs avec logo + nom | [ ] | [ ] | Si 1 seule org, doit-on rediriger directement ? |
| Lien `/staff` si staff | [ ] | [ ] | |

### `/account`

| Élément | Aucune inscription | Avec inscriptions | Profil incomplet | Notes |
|---|:-:|:-:|:-:|---|
| Alerte profil incomplet visible | — | — | [ ] | |
| Liste registrations triée par date desc | — | [ ] | — | |
| Statut affiché (badge couleur) | — | [ ] | — | Vérifier code couleur : PENDING orange, APPROVED vert, REJECTED rouge |
| Empty state lisible avec CTA | [ ] | — | — | |

### `/account/profile` et `/account/profile/complete`

| Élément | Vide | Rempli | Erreur upload | Notes |
|---|:-:|:-:|:-:|---|
| Upload photo avec preview | [ ] | [ ] | [ ] | Image > 5 Mo : message explicite |
| Upload document PDF | [ ] | [ ] | [ ] | |
| Indicateur "Profil complet ✓" | — | [ ] | — | |
| Section "obligatoire" vs "optionnel" | [ ] | [ ] | — | |

### `/account/registrations/[id]`

| Élément | PENDING | APPROVED | REJECTED | Notes |
|---|:-:|:-:|:-:|---|
| Snapshot lecture seule lisible | [ ] | [ ] | [ ] | |
| Motif de rejet affiché | — | — | [ ] | Mise en évidence visuelle |
| Bouton "Modifier profil + resoumettre" | — | — | [ ] | |
| Lien vers badge (download) | — | [ ] | — | |

### `/e/[slug]`

| Élément | Non connecté | Connecté profil complet | Profil incomplet | Event archivé | Notes |
|---|:-:|:-:|:-:|:-:|---|
| Branding (logo, titre, date, lieu) | [ ] | [ ] | [ ] | [ ] | Cascade event > org > platform |
| CTA "Se connecter pour s'inscrire" | [ ] | — | — | — | |
| CTA "S'inscrire à cet événement" | — | [ ] | — | — | |
| Message "Profil incomplet — compléter d'abord" | — | — | [ ] | — | |
| Message "Inscriptions fermées" ou "Événement clos" | — | — | — | [ ] | |

### `/e/[slug]/register`

| Élément | Vide | Sélectionnée | Erreur soumission | Notes |
|---|:-:|:-:|:-:|---|
| Récap profil en lecture seule | [ ] | [ ] | [ ] | |
| Liste catégories en cartes / radios | [ ] | [ ] | — | |
| Bouton submit disabled tant que catégorie/CGU non cochées | [ ] | — | — | |
| Message si "déjà inscrit" | — | — | [ ] | |

### `/e/[slug]/success`

| Élément | À vérifier | Notes |
|---|:-:|---|
| Message confirmation clair, prochaine étape (« vous recevrez un email ») | [ ] | |
| Boutons vers détail / `/account` | [ ] | |

### `/verify/[badgeId]` (page publique)

| Élément | Valide non-anonyme | Valide anonyme | Non valide | Inexistant | Notes |
|---|:-:|:-:|:-:|:-:|---|
| Badge "Valide" vert vs "Non valide" rouge clair | [ ] | [ ] | [ ] | [ ] | |
| Affichage nom + structure + event si non-anonyme | [ ] | — | — | — | |
| Masquage personnel si catégorie anonyme | — | [ ] | — | — | Seul l'event est affiché |

### `/badge/[id]` (download badge)

| Élément | À vérifier | Notes |
|---|:-:|---|
| Aperçu badge fidèle au PDF généré | [ ] | |
| Bouton de téléchargement responsive | [ ] | |
| Message si registration non APPROVED | [ ] | |

---

## Espace staff applicatif

### `/staff` (dashboard)

| Élément | Données vides | Données chargées | Notes |
|---|:-:|:-:|---|
| KPIs (orgs, events, inscriptions, top orgs) | [ ] | [ ] | |
| Cohérence visuelle des cards KPI | [ ] | [ ] | |
| Liens vers `/staff/organizations`, `/staff/activity` | [ ] | [ ] | |

### `/staff/organizations` + `/new` + `/[orgId]`

| Élément | À vérifier | Notes |
|---|:-:|---|
| Tableau avec recherche fonctionnelle | [ ] | |
| Filtre "archivées" toggle | [ ] | |
| Bouton "Nouvelle organisation" présent uniquement si STAFF_ADMIN+ | [ ] | Tester en STAFF_OBSERVER → bouton absent |
| Formulaire `/new` : champs adresse, quotas, owner — bien groupés | [ ] | |
| Détail org : sections distinctes (infos, OWNERs, quotas, paramètres, activité) | [ ] | |
| Bouton "Supprimer définitivement" visible uniquement SUPER_ADMIN | [ ] | |
| Modal hard delete : champ confirmation slug visible | [ ] | |
| StaffBanner sur `/admin/[orgId]` accédé depuis staff | [ ] | Doit indiquer "Mode staff", lien retour |

### `/staff/users` + `/new` + `/[userId]`

| Élément | À vérifier | Notes |
|---|:-:|---|
| Tableau avec filtres staff/clients/archivés | [ ] | |
| Form `/new` : sélecteurs adaptés au rôle staff connecté (SUPER_ADMIN seul voit SUPER_ADMIN option) | [ ] | |
| Détail user : sections orgMemberships / eventMemberships / activité | [ ] | |
| Boutons "Reset password" / "Archiver" / "Changer rôle" selon droits | [ ] | |

### `/staff/settings` + `/staff/settings/badge`

| Élément | À vérifier | Notes |
|---|:-:|---|
| Champs smtpPassword + recaptchaSecretKey type="password" | [ ] | Inspecter HTML |
| Indicateur "Mot de passe défini" si secret existe en BDD | [ ] | |
| Bouton "Test SMTP" déclenche modal de confirmation ou exécute direct | [ ] | |
| BadgeTemplatePicker : preview des templates, current value mis en évidence | [ ] | |

### `/staff/activity`

| Élément | À vérifier | Notes |
|---|:-:|---|
| Tableau avec filtres date / type / orgId / userId | [ ] | |
| Badge `staffActor` visible | [ ] | |
| Pagination claire | [ ] | |
| Empty state si aucun log | [ ] | |

---

## Espace organisation

### `/admin/[orgId]` (dashboard)

| Élément | À vérifier | Notes |
|---|:-:|---|
| KPI events / inscriptions / quota | [ ] | |
| Alerte quota > 80 % | [ ] | Forcer une org proche du quota |
| Liste 5 derniers events | [ ] | |
| 10 dernières entrées activity log | [ ] | |

### `/admin/[orgId]/settings` + `/settings/badge`

| Élément | À vérifier | Notes |
|---|:-:|---|
| Mode lecture seule en MANAGER et AUDITOR | [ ] | Form disabled |
| Champs SMTP **absents** (cascade plateforme/event) | [ ] | |
| Quotas en lecture seule (édition staff uniquement) | [ ] | |
| BadgeTemplatePicker : indique le template effectif (event/org/platform) | [ ] | |

### `/admin/[orgId]/members`

| Élément | À vérifier | Notes |
|---|:-:|---|
| Tableau avec rôle, date invitation, dernier login | [ ] | |
| Bouton "Inviter" présent uniquement OWNER | [ ] | |
| Modal invite : sélecteur rôle 3 choix | [ ] | |
| Action "Retirer" présente uniquement OWNER | [ ] | |

### `/admin/[orgId]/templates`

| Élément | À vérifier | Notes |
|---|:-:|---|
| Swatch couleur cliquable / éditable | [ ] | |
| Flags neutralBadge / anonymous lisibles | [ ] | |

### `/admin/[orgId]/events` + `/new`

| Élément | À vérifier | Notes |
|---|:-:|---|
| Liste avec filtres archivés / inscriptions ouvertes | [ ] | |
| Statut visuel (Actif / Inscriptions ouvertes / Fermé / Archivé) | [ ] | |
| Wizard 3 étapes : progress bar visible | [ ] | |
| Step 2 : sélection multi-templates fluide | [ ] | |
| Step 3 : récap exhaustif avant submit | [ ] | |
| Message quota dépassé clair | [ ] | |

### `/admin/[orgId]/activity`

Idem espace staff, scopé à l'org.

---

## Espace événement

### `/admin/[orgId]/events/[eventId]` (dashboard event)

| Élément | À vérifier par rôle | ADMIN | OPERATOR | PRINTER | VIEWER | Notes |
|---|:-:|:-:|:-:|:-:|:-:|---|
| KPI complets | [ ] | [ ] | [ ] | — | [ ] | VIEWER agrégé seul |
| "Mes scans" + lien `/scan` | — | — | [ ] | — | — | OPERATOR |
| Redirect `/badges` | — | — | — | [ ] | — | PRINTER |
| Mini-chart 30j | [ ] | [ ] | [ ] | — | [ ] | |

### `/admin/[orgId]/events/[eventId]/registrations` + `[regId]` + `/new`

| Élément | À vérifier | Notes |
|---|:-:|---|
| Filtres statut / catégorie / recherche fluides | [ ] | |
| Colonnes triables | [ ] | |
| Détail : photo + document preview lisibles | [ ] | |
| Boutons Approuver/Rejeter en couleur distincte | [ ] | |
| Modal "Rejeter" : champ raison obligatoire | [ ] | |
| Actions ADMIN-only visibles uniquement ADMIN | [ ] | |
| Form `/new` : équivalent au formulaire public | [ ] | |

### `/admin/[orgId]/events/[eventId]/badges` + `[badgeId]` + `/print`

| Élément | À vérifier | Notes |
|---|:-:|---|
| Filtres "non imprimé" / "all-access" / etc. | [ ] | |
| Aperçu PDF temps réel sur `[badgeId]` | [ ] | Fidèle au PDF téléchargé |
| Toggle all-access visible uniquement ADMIN | [ ] | |
| Batch print : N badges en grille | [ ] | |
| Marqueur "imprimé" visible après action | [ ] | |

### `/admin/[orgId]/events/[eventId]/categories`

| Élément | À vérifier | Notes |
|---|:-:|---|
| Swatch couleur visuel | [ ] | |
| Édition inline ou modal cohérente | [ ] | |
| Suppression refusée : message explicite "Inscriptions liées" | [ ] | |
| Bouton "Importer depuis templates" présent | [ ] | |

### `/admin/[orgId]/events/[eventId]/members`

| Élément | À vérifier | Notes |
|---|:-:|---|
| Tableau avec rôle event + indicateur "staff" si applicable | [ ] | |
| Modal invite : sélecteur rôle 4 choix (ADMIN/OPERATOR/PRINTER/VIEWER) | [ ] | |
| Autocomplete users de l'org | [ ] | |

### `/admin/[orgId]/events/[eventId]/settings` + `/settings/badge`

| Élément | À vérifier | Notes |
|---|:-:|---|
| Toggle `registrationOpen` visuellement distinct | [ ] | |
| Section "Contact override" claire (cascade affichée) | [ ] | |
| Liens vers blocked-emails/blocked-documents | [ ] | |
| BadgeTemplatePicker : current value + effective level | [ ] | |
| Bouton "Utiliser hérité" clair | [ ] | |

### `/admin/[orgId]/events/[eventId]/blocked-emails` + `/blocked-documents`

| Élément | À vérifier | Notes |
|---|:-:|---|
| Tableau avec recherche | [ ] | |
| Form d'ajout simple (email/numéro + raison opt.) | [ ] | |
| Action "Supprimer" avec confirmation | [ ] | |

### `/admin/[orgId]/events/[eventId]/scan`

| Élément | À vérifier | Notes |
|---|:-:|---|
| Caméra demande permission immédiate | [ ] | À tester en HTTPS local ou bypass |
| Résultat scan vert (authorized) vs rouge (denied) très distincts | [ ] | |
| Historique session bien aligné | [ ] | |
| Saisie manuelle accessible | [ ] | |
| Messages d'erreur en français : "Badge appartient à un autre événement", "Inscription non approuvée" | [ ] | |

### `/admin/[orgId]/events/[eventId]/activity`

| Élément | À vérifier | Notes |
|---|:-:|---|
| Liste avec filtres type/période/user | [ ] | |
| OPERATOR : voit ses scans uniquement, message explicite | [ ] | |
| Badge `staffActor` si applicable | [ ] | |

---

## Email (revue visuelle Mailpit)

Pour chaque email envoyé pendant les tests, ouvrir Mailpit `http://localhost:8025` et vérifier :

| Template | Sujet | Corps | Lien fonctionnel | Notes |
|---|:-:|:-:|:-:|---|
| `account-verify-email` | [ ] | [ ] | [ ] | Vérifier lien expire si visité après 24 h |
| `account-password-reset` | [ ] | [ ] | [ ] | Idem 1 h |
| `account-setup-password` (invitation) | [ ] | [ ] | [ ] | |
| `registration-confirmed` | [ ] | [ ] | [ ] | Branding event/org cascade visible |
| `registration-resubmitted` | [ ] | [ ] | [ ] | |
| `registration-approved` | [ ] | [ ] | [ ] | Lien vers `/account/registrations/[id]` |
| `registration-rejected` | [ ] | [ ] | [ ] | Motif rejet visible, lien resubmit |
| `badge-printed` | [ ] | [ ] | [ ] | Lien téléchargement badge |
| `member-invitation-event` | [ ] | [ ] | [ ] | Rôle event mentionné |
| `member-invitation-org` | [ ] | [ ] | [ ] | Rôle org mentionné |
| `test-smtp` | [ ] | [ ] | — | |

Vérifier aussi :
- L'expéditeur (`smtpFrom`) correspond à la cascade event > org > platform.
- Le HTML rendu n'a pas de "(undefined)" ou variable non substituée.
- Les liens utilisent `https://` en prod (en dev, http://localhost ou http://app:3000 selon contexte).

---

## PDF de badge (revue visuelle)

Pour chaque template actif (`default-v1`, `default-v2`, custom...), télécharger un badge et vérifier :

| Élément | À vérifier | Notes |
|---|:-:|---|
| Police lisible (Montserrat) | [ ] | Vérifier que Google Fonts est joignable en prod |
| QR code lisible | [ ] | Scanner depuis téléphone → `/verify/[id]` |
| Photo bien cadrée, non déformée | [ ] | |
| Couleur catégorie visible | [ ] | |
| Numéro de catégorie affiché si non-neutral | [ ] | |
| Anonymat respecté (catégorie `anonymous=true` masque nom) | [ ] | |
| Indicateur "All-access" si applicable | [ ] | |
| Format A6/A7 (selon template) respecté | [ ] | Vérifier dimensions PDF |
| Badge lisible imprimé en réel | [ ] | Tester impression sur papier |

---

## Cas globaux à vérifier sur **toutes** les pages admin

| Cas | À vérifier | Notes |
|---|:-:|---|
| Navigation sidebar / breadcrumb cohérente | [ ] | |
| Indicateur "page courante" dans la nav | [ ] | |
| Footer ou crédits constants | [ ] | |
| Comportement F5 / reload : état conservé ou rechargé proprement | [ ] | |
| Comportement clic "Retour" navigateur | [ ] | |
| Loading state (skeleton, spinner) lors d'un fetch lent | [ ] | Throttle network 3G |
| Toast/alerte success après action mutative | [ ] | |
| Toast/alerte error en cas d'échec API | [ ] | |
| Confirmation avant action destructive (suppression, hard delete) | [ ] | |
| Logout fonctionnel depuis n'importe quelle page | [ ] | |
| Accès direct à une URL réservée → 403 page ou redirect (pas un crash) | [ ] | |

---

## Procédure de passage de la checklist

1. **Avant**: démarrer l'app via `make dev`, ouvrir Mailpit `localhost:8025`, ouvrir DevTools (responsive).
2. **Pendant**: progresser espace par espace, viewport par viewport. Cocher au fur et à mesure.
3. **Trouvailles**: chaque bug visuel → ligne dans `docs/v2/specs/2026-06-01-e2e-visual-findings.md` (créer le fichier au besoin) avec : route, viewport, rôle, description courte, capture d'écran.
4. **Après**: commit `chore(visual-review): YYYY-MM-DD` qui met à jour cette checklist + `findings.md`.

Une checklist complètement cochée = on est OK pour release. Une checklist partielle = on documente les findings et on décide quels bugs bloquent.
