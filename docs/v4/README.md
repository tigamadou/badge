# Documentation - Badge v4

> **Statut : en construction**

La v4 regroupe sept chantiers appliques a la base v2/v3 :

1. HTTPS local (Caddy `tls internal`)
2. Retrait des quotas ad-hoc au profit d'un systeme d'abonnements
3. Systeme d'abonnements (plans catalogue + overrides, facturation manuelle)
4. Deconnexion via modal de confirmation
5. Choix du role a la creation/invitation d'utilisateurs
6. Stockage objet MinIO/S3 + champs upload fonctionnels
7. Separation complete des espaces (staff / organisation / evenement)

## Documents

### Plans a implementer

Les plans sont numerotes selon leur ordre d'execution (suffixe `-NN-` apres la date)
et retires du depot une fois implementes.

- [Spec 21 — Espaces utilisables sur mobile](specs/2026-10-22-21-v4-responsive-mobile.md) · [Plan](plans/2026-10-22-responsive-mobile.md) — audit a 375/768 px, tiroir de navigation sous 1024 px, gabarit commun `AppShell`, tableaux defilables. En attente de relecture.

- Lot notifications, queue d'emails et confort (specs 22 a 28), en attente de relecture :
  [22 — coordination](specs/2026-10-24-22-v4-lot-notifications-coordination.md) · [Plan socle](plans/2026-10-24-socle-commun.md) (**livre**) ·
  [23 — queue d'emails](specs/2026-10-24-23-v4-queue-emails.md) · [Plan](plans/2026-10-24-queue-emails.md) · [Feature](features/queue-emails.md) (**livre**, 2026-10-24) ·
  [24 — notifications](specs/2026-10-24-24-v4-notifications.md) · [Plan](plans/2026-10-24-notifications.md) · [Feature](features/notifications.md) (**livre**, 2026-10-24) ·
  [25 — categorie d'inscription rejetee](specs/2026-10-24-25-v4-categorie-inscription-rejetee.md) · [Plan](plans/2026-10-24-categorie-inscription-rejetee.md) · [Feature](features/inscriptions-resoumission.md) (**livre**, 2026-10-24) ·
  [26 — cover d'evenement](specs/2026-10-24-26-v4-cover-evenement.md) · [Plan](plans/2026-10-24-cover-evenement.md) · [Feature](features/cover-evenement.md) (**livre**, 2026-10-24) ·
  [27 — avatar photo validee](specs/2026-10-24-27-v4-avatar-photo-validee.md) · [Plan](plans/2026-10-24-avatar-photo-validee.md) · [Feature](features/validation-profils.md) (**livre**, 2026-10-24) ·
  [28 — feedback des actions](specs/2026-10-24-28-v4-feedback-actions.md) · [Plan](plans/2026-10-24-feedback-actions.md) · [Feature](features/feedback-actions.md) (**livre**, 2026-10-24)

### Chantiers livres

Les plans correspondants ont ete **supprimes du depot** apres implementation (demande du
2026-08-14) ; ils restent recuperables dans l'historique git. Les specs, elles, sont
conservees : elles portent le *pourquoi* des decisions.

- [Spec 06 — Correctifs profil participant & apercus](specs/2026-08-07-06-v4-correctifs-profil-participant-apercus.md)
- [Spec 07 — Affichage des details d'un evenement](specs/2026-08-07-07-v4-affichage-details-evenement.md)
- [Spec 08 — Validation des documents par le staff plateforme](specs/2026-08-07-08-v4-validation-documents-staff-plateforme.md) · [Feature](features/validation-profils.md)
- [Spec 09 — Parcours court d'inscription](specs/2026-08-11-09-v4-parcours-court-inscription.md)
- [Spec 10 — Format et moteur de templates declaratifs](specs/2026-08-11-10-v4-format-et-moteur-de-templates-declaratifs.md) · [Feature](features/templates-badges.md)
- [Spec 11 — Catalogue et installation de templates](specs/2026-08-11-11-v4-catalogue-et-installation-de-templates.md)
- [Spec 12 — Bascule des templates livres et retrait du registre](specs/2026-08-11-12-v4-bascule-des-templates-livres-et-retrait-du-registre.md)
- [Spec 13 — Page de detail d'un template de badge](specs/2026-08-11-13-v4-page-de-detail-d-un-template-de-badge.md)
- [Spec 14 — Apercu image et generation de template](specs/2026-08-11-14-v4-apercu-image-et-generation-de-template.md)
- [Spec 15 — Propagation du profil aux inscriptions en attente](specs/2026-08-14-15-v4-propagation-du-profil-aux-inscriptions-en-attente.md)
- [Spec 16 — Studio de construction de templates](specs/2026-08-14-16-v4-studio-de-construction-de-templates.md) · [Feature](features/templates-badges.md)
- [Spec 17 — Manifeste en pixels](specs/2026-08-14-17-v4-manifeste-en-pixels.md) · [Feature](features/templates-badges.md)
- [Spec 18 — Studio v2 : éditeur dynamique de badges](specs/2026-08-14-18-v4-studio-v2-editeur-dynamique.md) · [Feature](features/templates-badges.md)
- [Spec 19 — Studio v3 : groupes, formes et interface en trois colonnes](specs/2026-08-14-19-v4-studio-v3-groupes-formes-interface.md) · [Feature](features/templates-badges.md)
- [Spec 20 — Moteur v2 et liaisons de variables](specs/2026-09-22-20-v4-moteur-v2-et-liaisons.md) · [Plan](plans/2026-09-22-moteur-v2-et-liaisons.md) · [Feature](features/templates-badges.md)

Les plans 01 a 05 (juillet 2026) ont ete retires lors de reorganisations anterieures
(commits `a8ef855` et `b4af4c6`) et n'ont pas de spec associee.

### References

- [reCAPTCHA v3](features/recaptcha.md) — protection anti-spam de l'inscription et du mot de passe oublié : configuration, jeton côté navigateur, diagnostic.
- [Politique de tests](features/politique-tests.md) — 3 couches (unitaire / integration / E2E), seuils, matrice RBAC.
- [Lot notifications — socle commun](features/lot-notifications-socle.md) — contrats C1 a C4 (`enqueueEmail`, `NotificationBell`, `UserAvatar`, toasts) tels que livres.
- [Notifications internes et email](features/notifications.md) — cloche, panneau, pages par espace, matrice des evenements, destinataires, API, retention.
- [Loader et toast sur les actions](features/feedback-actions.md) — primitives, `apiErrorMessage`, motifs A a G, regles d'usage, helpers e2e.
- [Resoumission avec changement de categorie](features/inscriptions-resoumission.md) — `resubmit` (corps optionnel, nouvel ID, `INVALID_CATEGORY`), `allocateRegistrationId`, rejet interdit apres impression du badge.
- [Architecture](architecture.md) — structure des espaces, RBAC, garde-fous.
- [Installation](installation.md) — env, services, HTTPS local, commandes de test, CI.
- [Spec backups hebdomadaires](specs/2026-05-31-v4-stockage-s3-et-backups.md) — ADR (migre depuis v3-01) ; volet stockage S3/MinIO implemente et retire du document.
- [Checklist tests manuels navigateur](specs/2026-07-22-checklist-tests-manuels-navigateur.md) — recette manuelle complete page par page (68 pages, tous roles, transverse : emails, uploads, RBAC, responsive).

## Etat d'avancement

| Chantier | Etat |
|---|---|
| HTTPS local (item 1) | Livre |
| Separation des espaces + renommage (item 7) | Livre |
| Deconnexion (item 4) | Livre |
| Roles a la creation (item 5) | Livre |
| Stockage MinIO/S3 (item 6) | Driver S3 livre ; securisation `/api/files` et champs upload en cours |
| Abonnements (items 2+3) | Livre — catalogue `Plan` + `Subscription`, periodicite (30/365 j) pilotant les dates, slug org auto en lecture seule, blocage de l'espace org sans abonnement actif |
| Couverture de tests | Unitaire lib + integration API a **100%** (gate vert) ; cibles make + CI livrees |
| Reorganisation E2E par page | Livre — **un fichier par page** sur les 4 espaces (org 8, event 13, platform 15, public 12, transverse 2). Les fichiers transversaux `pages-render`/`rbac`/`interactions` sont dissous. Convention : [`e2e/README.md`](../../e2e/README.md) |
| Cover d'evenement (chantier 26) | Livre — composant `EventCover` (`hero` 3:1 / `thumb` 16:9) sur tableau de bord, pages publiques `/e/[slug]` et compte participant. Fiche : [`features/cover-evenement.md`](features/cover-evenement.md) |
| Avatar photo validee (chantier 27) | Livre — la photo de la derniere soumission `APPROVED` remplace les initiales dans l'en-tete de `/account`, `/platform`, `/org/[orgId]` et `/event/[eventId]`. Fiche : [`features/validation-profils.md`](features/validation-profils.md#photo-validée-comme-avatar) |
| Fidelite UI des tests E2E | Livre — contrat « zero `page.request` », parcours `/select`, verif URL, reponses succes/echec assertées. Plan 04 Task 5 closee 2026-07-21 (SMTP plateforme a surveiller : les tests Vitest peuvent corrompre `PlatformSettings.smtp`) |
| Correctifs profil participant & apercus (plan 06) | Livre — DTO des inscriptions aplati (colonnes Nom/E-mail corrigees), composant `DocumentPreview`, apercus photo/piece dans les espaces compte et evenement |
| Affichage des details d'un evenement (plan 07) | Livre — champs `description` / `endDate`, helper `formatEventPeriod`, carte `EventInfoCard` sur page publique + dashboard, periode dans la liste org, emails |
| Validation des documents par le staff plateforme (plan 08) | Livre — `ProfileSubmission` + `profileStatus`, catalogue `RejectionReason`, gate d'inscription (403) + gel de l'approbation (409), ecrans plateforme/participant/org. Voir [feature](features/validation-profils.md) |
| Parcours court d'inscription (plan 09) | Livre — inscription en 5 etapes au lieu de 8 ; le gate d'approbation de profil passe de l'entree a la sortie |
| Format et moteur de templates declaratifs (plan 10) | Livre — manifeste JSON + moteur produisant un badge identique aux templates React d'origine |
| Catalogue et installation de templates (plan 11) | Livre — televersement d'archive par le staff, template installe selectionnable comme les autres |
| Bascule des templates livres (plan 12) | Livre — `default` et `recto-verso` deviennent des donnees ; le registre compile est supprime |
| Page de detail d'un template (plan 13) | Livre — apercu, utilisateurs, versions de la famille, ressources, manifeste telechargeable |
| Apercu image et outillage (plan 14) | Livre — vignette image du paquet, PDF d'epreuve conserve, outillage local `make new-badge-template` et `make pack-badge-template` (le premier retire depuis la spec 20 : le studio pdfStudio cree desormais les templates) |
| Propagation du profil aux inscriptions (plan 15) | Livre — les snapshot* sont figes a l'approbation et non plus a la creation ; audit `REGISTRATION_SNAPSHOT_REFRESHED` ; la piece d'identite disparait du detail cote organisation. **Recette visuelle a faire** |
| Studio de construction de templates (plan 16) | Livre — service de dev separe (`make studio`, port 3786), edition du manifeste avec apercu PDF a la frappe et cinq jeux de donnees. **Recette visuelle a faire** ; `make dev-https-hosts` a lancer pour studio.badge.local |
| Espaces utilisables sur mobile (plan 21) | Spec et plan rediges (2026-10-22), implementation non commencee |
| Lot notifications — socle (spec 22) | Livre (2026-10-24) — `enqueueEmail` (envoi immediat), cloche vide + entrees de menu et pages d'attente, `UserAvatar`, toasts `sonner` + `Button loading` + `useAsyncAction`. Voir [feature](features/lot-notifications-socle.md) |
| Lot notifications — queue d'emails (spec 23) | Livre (2026-10-24) — table `Job`, worker (`SKIP LOCKED`, backoff, orphelins, retention), `enqueueEmail` insere en base, ecran `/platform/jobs` (relance, annulation). Voir [feature](features/queue-emails.md). `deploy.sh` et la CI adaptes pour le worker ; rien n'est deploye |
| Lot notifications — categorie d'inscription rejetee (spec 25) | Livre (2026-10-24) — `resubmit` accepte `{ categoryId }`, nouvel ID en transaction (`allocateRegistrationId`), selecteur `RadioCards` et redirection ; rejet refuse si le badge est imprime (`BADGE_ALREADY_PRINTED`). Voir [feature](features/inscriptions-resoumission.md) |
| Lot notifications — notifications internes et email (spec 24) | Livre (2026-10-24) — table `Notification`, service `src/lib/notifications/` (destinataires, `notify`, declencheurs), cloche + panneau (polling 30 s), pages des quatre espaces, email par la queue, retention 90 j dans le worker, `EMAIL_FAILED`. Voir [feature](features/notifications.md) |
| Lot notifications — feedback des actions (spec 28) | Livre (2026-10-24) — loader + `disabled` + toast sur toutes les actions des quatre espaces et des pages publiques (`useAsyncAction`, `ActionButton`, `apiErrorMessage` qui filtre codes et messages anglais, erreurs de champ sous les champs). Voir [feature](features/feedback-actions.md) |

Pour un chantier livre, le detail task par task vit dans l'historique git du plan
supprime ; le *pourquoi* reste dans la spec.
