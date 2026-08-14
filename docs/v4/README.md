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

Numerotes selon leur ordre d'execution (suffixe `-NN-` apres la date) :

- [15 — Propagation du profil aux inscriptions en attente](plans/2026-08-14-15-v4-propagation-du-profil-aux-inscriptions-en-attente.md) — snapshots figes a l'approbation et non plus a la creation ; retrait de l'encart de piece d'identite cote organisation. [Spec](specs/2026-08-14-15-v4-propagation-du-profil-aux-inscriptions-en-attente.md).
- [16 — Studio de construction de templates](plans/2026-08-14-16-v4-studio-de-construction-de-templates.md) — service de developpement separe : edition du manifeste avec apercu PDF instantane. [Spec](specs/2026-08-14-16-v4-studio-de-construction-de-templates.md).

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

Les plans 01 a 05 (juillet 2026) ont ete retires lors de reorganisations anterieures
(commits `a8ef855` et `b4af4c6`) et n'ont pas de spec associee.

### References

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
| Correctifs profil participant & apercus (plan 06) | Livre — DTO des inscriptions aplati (colonnes Nom/E-mail corrigees), composant `DocumentPreview`, apercus photo/piece dans les espaces compte et evenement |
| Affichage des details d'un evenement (plan 07) | Livre — champs `description` / `endDate`, helper `formatEventPeriod`, carte `EventInfoCard` sur page publique + dashboard, periode dans la liste org, emails |
| Validation des documents par le staff plateforme (plan 08) | Livre — `ProfileSubmission` + `profileStatus`, catalogue `RejectionReason`, gate d'inscription (403) + gel de l'approbation (409), ecrans plateforme/participant/org. Voir [feature](features/validation-profils.md) |
| Parcours court d'inscription (plan 09) | Livre — inscription en 5 etapes au lieu de 8 ; le gate d'approbation de profil passe de l'entree a la sortie |
| Format et moteur de templates declaratifs (plan 10) | Livre — manifeste JSON + moteur produisant un badge identique aux templates React d'origine |
| Catalogue et installation de templates (plan 11) | Livre — televersement d'archive par le staff, template installe selectionnable comme les autres |
| Bascule des templates livres (plan 12) | Livre — `default` et `recto-verso` deviennent des donnees ; le registre compile est supprime |
| Page de detail d'un template (plan 13) | Livre — apercu, utilisateurs, versions de la famille, ressources, manifeste telechargeable |
| Apercu image et outillage (plan 14) | Livre — vignette image du paquet, PDF d'epreuve conserve, `make new-badge-template` et `make pack-badge-template` |
| Propagation du profil aux inscriptions (plan 15) | A implementer |
| Studio de construction de templates (plan 16) | A implementer |

Pour un chantier livre, le detail task par task vit dans l'historique git du plan
supprime ; le *pourquoi* reste dans la spec.
