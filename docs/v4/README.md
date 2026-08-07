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

Plans en cours, numerotes selon leur ordre d'execution (suffixe `-NN-` apres la date) :

- [01 — Corrections bugs pre-E2E](plans/2026-07-20-01-v4-fixes-bugs-pre-e2e.md) — **d'abord** : verify-email, acces PRINTER badges, suppression /badge/[id].
- [02 — Abonnements (periodicite, slug auto, blocage org)](plans/2026-07-20-02-v4-abonnements-periodicite-slug-blocage.md) — tracker de progression en tete.
- [03 — Reorganisation E2E par page](plans/2026-07-20-03-v4-e2e-reorg-par-page.md) — un fichier de specs par page, toutes les actions testees, tous les espaces (suppose 01 termine).
- [04 — Fidelite UI des tests E2E](plans/2026-07-20-04-v4-e2e-fidelite-ui.md) — parcours UI complet (jamais d'API, /select, verif URL, reponse succes/echec assertee). Suite du 03.
- [06 — Correctifs profil participant & apercus](plans/2026-08-07-06-v4-correctifs-profil-participant-apercus.md) — **a implementer** : DTO des inscriptions (colonnes vides), composant `DocumentPreview`, apercus photo/piece. [Spec](specs/2026-08-07-06-v4-correctifs-profil-participant-apercus.md).
- [07 — Affichage des details d'un evenement](plans/2026-08-07-07-v4-affichage-details-evenement.md) — **a implementer** : champs `description` / `endDate`, carte d'informations sur les 3 vues. [Spec](specs/2026-08-07-07-v4-affichage-details-evenement.md).
- [08 — Validation des documents par le staff plateforme](plans/2026-08-07-08-v4-validation-documents-staff-plateforme.md) — **a implementer**, suppose le 06 termine : `ProfileSubmission`, catalogue de motifs, gate d'inscription. [Spec](specs/2026-08-07-08-v4-validation-documents-staff-plateforme.md).
- [Politique de tests](features/politique-tests.md) — 3 couches (unitaire / integration / E2E), seuils, matrice RBAC.
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
| Fidelite UI des tests E2E | Livre — contrat « zero `page.request` », parcours `/select`, verif URL, reponses succes/echec assertées. Plan 04 Task 5 closee 2026-07-21 (SMTP plateforme a surveiller : les tests Vitest peuvent corrompre `PlatformSettings.smtp`) |
| Correctifs profil participant & apercus (plan 06) | En cours — DTO des inscriptions aplati (colonnes Nom/E-mail corrigees), composant `DocumentPreview`, apercus photo/piece dans les espaces compte et evenement |

Voir la section `## Progression` du plan pour le detail task par task.
