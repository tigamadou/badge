# Audit et mise à jour complète de la documentation

**Date** : 2026-05-28
**Statut** : Approuvé pour planification

## Contexte

Le projet Investiture compte ~6700 lignes de documentation réparties dans `docs/` (README, architecture, base-de-donnees, installation, `api/`, `features/`, `guide-utilisateur/`, `superpowers/`). De nombreux changements récents (badges anonymes, bannière ALL ACCESS, formatage progressif des prénoms, blocage de doublons par email/document, désactivation des inscriptions, etc.) ont pu introduire des écarts entre le code et la documentation.

## Objectif

Vérifier que toute la documentation utilisateur et technique reflète le comportement actuel de l'application, mettre à jour ce qui diverge, et créer la documentation manquante pour les fonctionnalités non couvertes.

## Périmètre

**Inclus** :
- `docs/README.md`, `docs/architecture.md`, `docs/base-de-donnees.md`, `docs/installation.md`
- `docs/api/` (tous fichiers)
- `docs/features/` (tous fichiers)
- `docs/guide-utilisateur/` (tous fichiers)
- `README.md` à la racine

**Exclus** :
- `docs/superpowers/` (specs et plans historiques figés)
- Le code source (aucune modification de code)

## Approche : 3 phases avec agents parallèles

### Phase 1 — Inventaire (1 agent séquentiel)

Un agent cartographe explore le code et produit `docs/.audit-inventory.md` (fichier temporaire) contenant :

- **Routes UI** : toutes les `src/app/**/page.tsx`, leur URL, le rôle requis, comportement résumé
- **Endpoints API** : toutes les `src/app/api/**/route.ts`, verbe(s), paramètres, auth, code de statut renvoyés
- **Modèles Prisma** : depuis `prisma/schema.prisma` — modèles, champs, relations, enums (notamment `ActivityType`, `Role`, `RegistrationStatus`)
- **Permissions effectives** : depuis `middleware.ts`, `lib/auth.ts`, et les vérifications inline dans les routes
- **Variables d'environnement** : grep des `process.env.*` dans le code
- **Inventaire docs existant** : liste de chaque fichier `.md` du périmètre avec une ligne de résumé de son contenu actuel
- **Notes** : sections du code qui semblent non-triviales et méritent une attention particulière

Cet inventaire sert de source de vérité unique pour la Phase 2, évitant que chaque agent refasse la même exploration.

### Phase 2 — Mise à jour par domaine (4 agents en parallèle)

Chaque agent reçoit en input :
- Le chemin du fichier d'inventaire
- La liste exacte de ses docs à traiter
- La liste exacte de ses fichiers de code à analyser
- Le protocole de mise à jour (voir ci-dessous)

Routes UI réelles dans `src/app/admin/` : `activity-logs`, `badges`, `categories`, `event`, `profile`, `registrations`, `settings`, `teams`, `users`.
Routes API réelles dans `src/app/api/` : `activity-logs`, `auth`, `edit-registration`, `event`, `files`, `profile`, `registrations`, `scan`, `settings`, `setup-password`, `teams`, `upload`, `users`, `verify`.

| Agent | Domaine | Code (chemins relatifs à `src/`) | Docs à mettre à jour |
|-------|---------|----------------------------------|---------------------|
| **A** | Auth, Utilisateurs, Équipes & Profil | `app/login`, `app/setup-password`, `app/verify`, `app/admin/users`, `app/admin/teams`, `app/admin/profile`, `lib/auth.ts`, `middleware.ts`, `app/api/auth/**`, `app/api/setup-password/**`, `app/api/verify/**`, `app/api/users/**`, `app/api/teams/**`, `app/api/profile/**` | `features/authentification-et-roles.md`, `features/gestion-utilisateurs.md`, `api/authentification.md`, `api/utilisateurs.md`, `guide-utilisateur/connexion.md`, `guide-utilisateur/utilisateurs.md` |
| **B** | Inscriptions, Badges & Fichiers | `app/register`, `app/edit-registration`, `app/admin/registrations`, `app/admin/badges`, `app/badge`, `app/badge-preview`, `lib/format-badge-name.ts`, `lib/storage.ts`, `lib/image-to-dataurl.ts`, `components/badge`, `app/api/registrations/**`, `app/api/edit-registration/**`, `app/api/files/**`, `app/api/upload/**` | `features/inscription-publique.md`, `features/gestion-inscriptions.md`, `features/badges.md`, `features/export-badges-pdf.md`, `api/inscriptions.md`, `api/fichiers.md`, `guide-utilisateur/inscriptions.md`, `guide-utilisateur/badges.md` |
| **C** | Scan & Catégories | `app/scan`, `app/admin/categories`, `lib/qrcode.ts`, `app/api/scan/**`, `app/api/categories/**` (si existe — sinon catégories gérées via teams/settings, l'agent A clarifie) | `features/scan-qr.md`, `features/gestion-categories.md`, `api/scan.md`, `api/categories.md`, `guide-utilisateur/scanner.md`, `guide-utilisateur/categories.md` |
| **D** | Événement, Paramètres, Journal & Tableau de bord | `app/admin/page.tsx` (tableau de bord), `app/admin/event`, `app/admin/settings`, `app/admin/activity-logs`, `lib/activity-log.ts`, `lib/mail.ts`, `components/admin`, `app/api/event/**`, `app/api/settings/**`, `app/api/activity-logs/**` | `features/configuration-evenement.md`, `features/parametres-systeme.md`, `features/journal-activite.md`, `features/notifications-email.md`, `api/evenement.md`, `api/parametres.md`, `api/journal-activite.md`, `guide-utilisateur/evenement.md`, `guide-utilisateur/parametres.md`, `guide-utilisateur/journal-activite.md`, `guide-utilisateur/tableau-de-bord.md` |

**Note importante** : les noms de routes anglais dans le code (`registrations`, `event`, `settings`, `activity-logs`, `users`) correspondent à des noms français dans les docs (`inscriptions`, `evenement`, `parametres`, `journal-activite`, `utilisateurs`). Les agents préservent cette convention (URLs en anglais, docs en français).

**Protocole de mise à jour** (identique pour les 4 agents) :

1. Lire intégralement le fichier d'inventaire pour avoir le contexte global
2. Pour chaque doc du périmètre :
   - Lire le fichier de doc actuel
   - Lire les fichiers de code pertinents listés dans l'inventaire
   - Identifier les divergences (informations obsolètes, incorrectes, manquantes)
   - Mettre à jour le contenu en place avec l'outil Edit, en préservant la structure markdown et le style (tables, sections, ton, langue)
3. Pour les fonctionnalités du périmètre non couvertes par une doc existante :
   - Créer un nouveau fichier `.md` au bon endroit, en suivant le style des fichiers existants du même type (api/, features/, guide-utilisateur/)
   - Si une nouvelle doc nécessite d'apparaître dans un index (`docs/api/README.md`, `docs/guide-utilisateur/README.md`), le signaler dans le résumé (la mise à jour des index sera faite en Phase 3)
4. Retourner un résumé structuré au format :
   ```
   ## Fichiers modifiés
   - <chemin> : <raisons en 1 ligne>
   ## Fichiers créés
   - <chemin> : <raisons en 1 ligne>
   ## Fichiers inchangés
   - <chemin>
   ## À signaler en Phase 3
   - Index à mettre à jour, terminologie incohérente détectée, etc.
   ```

### Phase 3 — Finalisation (1 agent séquentiel)

Un agent intégrateur :

1. Lit tous les résumés de Phase 2
2. Met à jour les docs transverses en s'appuyant sur l'inventaire :
   - `README.md` (racine)
   - `docs/README.md`
   - `docs/architecture.md`
   - `docs/base-de-donnees.md`
   - `docs/installation.md`
   - `docs/api/README.md`
   - `docs/guide-utilisateur/README.md`
3. Met à jour les index pour intégrer les nouveaux fichiers créés en Phase 2
4. Vérifie la cohérence inter-domaines :
   - Liens internes valides
   - Terminologie homogène (ex: "inscription" vs "enregistrement", "scan" vs "scanning")
   - Pas de section orpheline ou de référence à du code supprimé
5. Compile `docs/.audit-report-2026-05-28.md` (rapport final) avec :
   - Résumé exécutif (compteurs : N fichiers modifiés, M fichiers créés, K inchangés)
   - Liste détaillée par domaine
   - Points d'attention pour le user (terminologie, divergences notables détectées, suggestions)
6. Supprime `docs/.audit-inventory.md` (temporaire)

## Garde-fous

- **Pas de modification du code source** : les agents ont uniquement le droit d'éditer/créer des fichiers `.md` dans `docs/` et le `README.md` racine
- **Pas de git commit** : le user reviewra le diff complet avant tout commit
- **Pas de modification de `docs/superpowers/`** : specs et plans historiques figés
- **Langue et style** : français, en respectant le style en place de chaque fichier (le README racine n'utilise pas les accents — les agents respectent la convention locale du fichier qu'ils éditent)
- **Préserver la structure markdown existante** : tables, hiérarchie de titres, conventions de nommage
- **Pas d'ajout d'emojis** sauf s'ils sont déjà présents dans le fichier

## Critères de succès

- Toutes les docs du périmètre ont été soit vérifiées, soit mises à jour
- Toute fonctionnalité visible utilisateur ou tout endpoint API public a une entrée dans la doc correspondante
- Le rapport final liste sans ambiguïté ce qui a changé
- Les fichiers temporaires (`.audit-inventory.md`) sont supprimés à la fin
- Le diff est reviewable par le user avant tout commit

## Risques et mitigations

| Risque | Mitigation |
|--------|------------|
| Deux agents éditent la même doc (impossible vu le découpage, mais sécurité) | Découpage par domaine sans recouvrement vérifié dans le tableau Phase 2 |
| Un agent invente du contenu non présent dans le code | Protocole impose la lecture du code avant l'édition ; rapport final signale tout ajout |
| Incohérence terminologique entre agents | Phase 3 dédiée à la vérification de cohérence |
| Inventaire incomplet pénalisant la Phase 2 | L'agent cartographe a un mandat large ; les agents Phase 2 peuvent compléter par leurs propres lectures si besoin |
| Index (`README.md` de sous-dossiers) désynchronisés | Phase 3 met à jour les index en s'appuyant sur les rapports Phase 2 |

## Livrables

1. Fichiers `.md` du périmètre mis à jour (en place) ou créés
2. `docs/.audit-report-2026-05-28.md` : rapport final consolidé
3. Pas de commit — le user décide
