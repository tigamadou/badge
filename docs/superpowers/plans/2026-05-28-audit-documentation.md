# Audit et mise à jour de la documentation - Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vérifier et mettre à jour toute la documentation du projet Investiture (`README.md` racine + `docs/` hors `superpowers/`) pour qu'elle reflète le comportement actuel de l'application.

**Architecture:** 3 phases séquentielles. Phase 1 : 1 agent cartographe produit un inventaire du code. Phase 2 : 4 agents parallèles mettent à jour la doc par domaine fonctionnel. Phase 3 : 1 agent intégrateur met à jour les docs transverses, harmonise et produit un rapport final.

**Tech Stack:** Outils Agent (subagent_type=Explore pour Phase 1, general-purpose pour Phases 2 et 3). Aucune modification de code source — uniquement édition/création de fichiers `.md`.

**Spec de référence:** `docs/superpowers/specs/2026-05-28-audit-documentation-design.md`

---

## File Structure

**Fichiers temporaires créés pendant l'exécution** (puis supprimés en fin de Phase 3) :
- `docs/.audit-inventory.md` — inventaire produit par l'agent cartographe (Phase 1)

**Fichiers de sortie finaux** :
- `docs/.audit-report-2026-05-28.md` — rapport final consolidé (créé en Phase 3)
- Fichiers `.md` existants mis à jour en place dans : `README.md`, `docs/*.md`, `docs/api/*.md`, `docs/features/*.md`, `docs/guide-utilisateur/*.md`
- Nouveaux fichiers `.md` créés au besoin pour combler les gaps

**Fichiers strictement hors périmètre** (ne JAMAIS modifier) :
- Tout fichier dans `src/`, `prisma/`, `cypress/`, `scripts/`, `docker/`, `public/`
- Tout fichier dans `docs/superpowers/`
- Fichiers de configuration (`package.json`, `next.config.ts`, `tsconfig.json`, etc.)

---

## Task 1: Phase 1 — Dispatcher l'agent cartographe

**Files:**
- Create: `docs/.audit-inventory.md` (par l'agent dispatché)

- [ ] **Step 1: Dispatcher l'agent Explore avec le prompt suivant**

Dispatcher un agent avec `subagent_type: "Explore"` et le prompt complet ci-dessous.

```
Tu es l'agent cartographe d'un audit de documentation. Tu travailles dans le projet /Users/amadou/Devs/projects/badge (Next.js 16, Prisma 6, MySQL, NextAuth, TypeScript). Ton unique livrable est le fichier docs/.audit-inventory.md qui servira de source de vérité à 5 autres agents.

Tu n'écris RIEN d'autre que ce fichier. Tu ne modifies AUCUN code source.

Voici la structure exacte du fichier à produire (utilise ces titres tels quels) :

# Inventaire du code - 2026-05-28

## 1. Routes UI (src/app/**/page.tsx)

Pour chaque page :
- **URL** : chemin URL réel (ex: /admin/registrations)
- **Fichier** : chemin du page.tsx
- **Rôle requis** : public | OPERATOR | ADMIN | SUPER_ADMIN (depuis middleware.ts + checks inline)
- **Comportement** : 2-3 lignes décrivant ce que fait la page

## 2. Endpoints API (src/app/api/**/route.ts)

Pour chaque endpoint, un sous-section avec :
- **URL** : ex /api/registrations/[id]
- **Fichier** : chemin route.ts
- **Méthodes** : GET, POST, PATCH, DELETE (lesquelles sont exportées)
- **Auth** : rôle requis ou "public"
- **Paramètres** : path params, query params, body schema (synthèse, pas les types exacts)
- **Réponses** : codes HTTP retournés et cas correspondants

## 3. Modèles Prisma (prisma/schema.prisma)

Pour chaque model :
- **Nom**
- **Champs** : liste avec type
- **Relations** : avec autres models
- **Index/contraintes** notables

Puis pour chaque enum : nom + valeurs.
Attention particulière aux enums ActivityType, Role, RegistrationStatus.

## 4. Permissions effectives

- Tableau "Action -> Rôle minimum requis" pour les actions principales (créer/voir/modifier/supprimer chaque ressource).
- Source : middleware.ts + lib/auth.ts + checks inline dans les routes.

## 5. Variables d'environnement utilisées

Liste de tous les process.env.* trouvés dans le code (src/, prisma/, scripts/, docker-entrypoint.sh).
Pour chacun : nom, où il est utilisé, valeur par défaut s'il y en a une.

## 6. Bibliothèques métier (src/lib/)

Pour chaque fichier de src/lib/ :
- **Fichier**
- **Exports** : fonctions/constantes exportées avec signature
- **Rôle** : 1-2 lignes

## 7. Composants notables (src/components/)

Survol par sous-dossier : que fait chaque sous-dossier, composants principaux.

## 8. Logique métier non triviale

Sections qui méritent attention :
- format-badge-name.ts : règles de troncature/formatage
- Génération du PDF de badge (composants badge/)
- Génération QR code
- Logique d'inscription (statuts, transitions)
- Workflow d'édition d'inscription après approbation/rejet
- Logique anonyme / ALL ACCESS
- Blocage de doublons (email, document)

Pour chacune : où c'est implémenté + résumé des règles.

## 9. Inventaire des docs existantes

Pour chaque fichier .md du périmètre (README.md racine + docs/ sauf docs/superpowers/), une ligne :
- chemin -> X lignes -> sujet en une ligne

## 10. Gaps potentiels détectés

Liste des fonctionnalités/endpoints/pages que tu n'arrives pas à matcher avec une doc existante.

---

Termine par une ligne "Inventaire complété par l'agent cartographe le 2026-05-28."

Exigences :
- Sois exhaustif sur les sections 1, 2, 3, 5, 9 — c'est la source de vérité.
- Pour les sections de prose (4, 6, 7, 8), reste concis : phrases courtes, tirets.
- Cite toujours les chemins de fichiers réels avec le préfixe src/ ou prisma/.
- N'invente rien : si tu n'es pas sûr d'un comportement, écris "À vérifier" plutôt que de deviner.

Quand le fichier est écrit, retourne juste son chemin et un résumé en 5 lignes max de ce que tu as trouvé.
```

- [ ] **Step 2: Vérifier que l'inventaire existe et est non-vide**

Run: `wc -l docs/.audit-inventory.md`
Expected: au moins 200 lignes (sinon l'agent a probablement raté quelque chose — relancer en lui demandant d'être plus exhaustif).

- [ ] **Step 3: Lire l'inventaire pour valider sa qualité**

Lire `docs/.audit-inventory.md` et vérifier que les 10 sections sont présentes. Si une section est vide ou bâclée, relancer l'agent en pointant les manques précis.

- [ ] **Step 4: Pas de commit à cette étape**

L'inventaire est un fichier temporaire qui sera supprimé en Phase 3. Pas de git add/commit.

---

## Task 2: Phase 2 — Dispatcher les 4 agents de mise à jour par domaine en parallèle

**Files:**
- Modify/Create: fichiers `.md` du périmètre de chaque agent (voir prompts)

- [ ] **Step 1: Dispatcher les 4 agents dans un seul message**

Envoyer un seul message avec 4 tool calls Agent en parallèle, `subagent_type: "general-purpose"` pour chacun. Utiliser les prompts exacts ci-dessous.

**Prompt Agent A — Auth, Utilisateurs, Équipes & Profil :**

```
Tu es l'agent A d'un audit de documentation pour le projet /Users/amadou/Devs/projects/badge.

Ton domaine : Authentification, Utilisateurs, Équipes, Profil.

Avant tout, lis intégralement docs/.audit-inventory.md (produit par l'agent cartographe) — c'est ta source de vérité unique sur le code.

Fichiers de code de ton périmètre (lecture seule) :
- src/app/login/**, src/app/setup-password/**, src/app/verify/**
- src/app/admin/users/**, src/app/admin/teams/**, src/app/admin/profile/**
- src/lib/auth.ts, src/middleware.ts
- src/app/api/auth/**, src/app/api/setup-password/**, src/app/api/verify/**
- src/app/api/users/**, src/app/api/teams/**, src/app/api/profile/**

Docs à vérifier et mettre à jour (édition en place autorisée) :
- docs/features/authentification-et-roles.md
- docs/features/gestion-utilisateurs.md
- docs/api/authentification.md
- docs/api/utilisateurs.md
- docs/guide-utilisateur/connexion.md
- docs/guide-utilisateur/utilisateurs.md

Protocole :
1. Lire intégralement l'inventaire pour le contexte global.
2. Pour chaque doc ci-dessus :
   a. Lire le fichier de doc actuel.
   b. Lire les fichiers de code pertinents.
   c. Identifier les divergences (obsolète, incorrect, manquant).
   d. Mettre à jour en place avec Edit, en préservant la structure markdown et le style (tables, sections, ton, langue, présence ou absence d'accents — respecte ce que tu trouves).
3. Si une fonctionnalité de ton périmètre n'est pas couverte par une doc existante :
   a. Créer un nouveau fichier .md au bon endroit (api/, features/, ou guide-utilisateur/).
   b. Suivre le style des fichiers voisins du même type.
   c. Si ce nouveau fichier doit apparaître dans un README index, le signaler dans le rapport (Phase 3 mettra à jour les index).
4. Notes spéciales :
   - L'équipe (teams) et le profil (profile) ne sont peut-être pas du tout documentés actuellement — vérifier et créer la doc si nécessaire.
   - Si features/gestion-utilisateurs.md ne couvre pas les équipes, soit l'étendre soit créer features/gestion-equipes.md selon ce qui est le plus cohérent.

Interdictions strictes :
- Ne modifier AUCUN fichier hors de tes docs listées (sauf création de nouvelles docs).
- Ne modifier AUCUN code source.
- Ne pas commit.
- Ne pas modifier docs/.audit-inventory.md ni docs/superpowers/**.

Livrable final :
Retourne un rapport au format exact suivant :

## Agent A — Résumé

### Fichiers modifiés
- <chemin> : <raisons en 1 ligne>

### Fichiers créés
- <chemin> : <raisons en 1 ligne>

### Fichiers inchangés (vérifiés conformes)
- <chemin>

### À signaler en Phase 3
- <index à mettre à jour, terminologie suggérée, etc.>
```

**Prompt Agent B — Inscriptions, Badges & Fichiers :**

```
Tu es l'agent B d'un audit de documentation pour /Users/amadou/Devs/projects/badge.

Ton domaine : Inscriptions, Badges, Fichiers (upload/download).

Lis d'abord docs/.audit-inventory.md.

Fichiers de code de ton périmètre :
- src/app/register/**, src/app/edit-registration/**
- src/app/admin/registrations/**, src/app/admin/badges/**
- src/app/badge/**, src/app/badge-preview/**
- src/lib/format-badge-name.ts, src/lib/storage.ts, src/lib/image-to-dataurl.ts
- src/components/badge/**
- src/app/api/registrations/**, src/app/api/edit-registration/**
- src/app/api/files/**, src/app/api/upload/**

Docs à vérifier :
- docs/features/inscription-publique.md
- docs/features/gestion-inscriptions.md
- docs/features/badges.md
- docs/features/export-badges-pdf.md
- docs/api/inscriptions.md
- docs/api/fichiers.md
- docs/guide-utilisateur/inscriptions.md
- docs/guide-utilisateur/badges.md

Protocole identique à l'agent A (lire inventaire, comparer, mettre à jour, créer si gap, ne pas commit).

Points d'attention spécifiques :
- Règles de formatage des noms sur le badge (src/lib/format-badge-name.ts) : troncature progressive, ellipsis, limites de caractères (commits récents : 18, 20, 28, 30 chars selon le champ).
- Logique de badge anonyme + bannière ALL ACCESS.
- Logique d'édition d'inscription après approbation ET après rejet (deux flows distincts).
- Blocage de doublons : email + document (DocumentType + numéro de document).
- Désactivation des inscriptions publiques (feature toggle ou paramètre).

Interdictions strictes identiques à l'agent A.

Livrable final : même format de rapport que l'agent A, sous le titre "## Agent B — Résumé".
```

**Prompt Agent C — Scan & Catégories :**

```
Tu es l'agent C d'un audit de documentation pour /Users/amadou/Devs/projects/badge.

Ton domaine : Scan QR, Catégories.

Lis d'abord docs/.audit-inventory.md.

Fichiers de code de ton périmètre :
- src/app/scan/**
- src/app/admin/categories/**
- src/lib/qrcode.ts
- src/app/api/scan/**

Si tu trouves des routes API liées aux catégories ailleurs (ex: gérées via /api/settings ou /api/teams), suis-les jusqu'à leur implémentation réelle.

Docs à vérifier :
- docs/features/scan-qr.md
- docs/features/gestion-categories.md
- docs/api/scan.md
- docs/api/categories.md
- docs/guide-utilisateur/scanner.md
- docs/guide-utilisateur/categories.md

Protocole identique aux agents A/B.

Points d'attention spécifiques :
- Modification récente des numéros de catégorie (commit "category numbers edited").
- Logique de flag de duplicate au scan (commit "duplicate flag logic added").
- Workflow temps réel du scan : caméra (html5-qrcode), accès, refus, raisons.

Interdictions strictes identiques.

Livrable final : même format, "## Agent C — Résumé".
```

**Prompt Agent D — Événement, Paramètres, Journal & Tableau de bord :**

```
Tu es l'agent D d'un audit de documentation pour /Users/amadou/Devs/projects/badge.

Ton domaine : Événement, Paramètres, Journal d'activité, Tableau de bord, Notifications email.

Lis d'abord docs/.audit-inventory.md.

Fichiers de code de ton périmètre :
- src/app/admin/page.tsx (tableau de bord admin)
- src/app/admin/event/**, src/app/admin/settings/**, src/app/admin/activity-logs/**
- src/lib/activity-log.ts, src/lib/mail.ts
- src/components/admin/**
- src/app/api/event/**, src/app/api/settings/**, src/app/api/activity-logs/**

Docs à vérifier :
- docs/features/configuration-evenement.md
- docs/features/parametres-systeme.md
- docs/features/journal-activite.md
- docs/features/notifications-email.md
- docs/api/evenement.md
- docs/api/parametres.md
- docs/api/journal-activite.md
- docs/guide-utilisateur/evenement.md
- docs/guide-utilisateur/parametres.md
- docs/guide-utilisateur/journal-activite.md
- docs/guide-utilisateur/tableau-de-bord.md

Protocole identique aux agents A/B/C.

Points d'attention spécifiques :
- Enum ActivityType : valeurs complètes (notamment EDIT_LINK_SENT ajouté récemment).
- Tous les types d'emails envoyés (lib/mail.ts) doivent être documentés dans notifications-email.md avec : déclencheur, destinataire, contenu résumé.
- Logique du tableau de bord : quelles métriques affichées, quelles permissions par rôle.
- Désactivation des inscriptions : si c'est un paramètre, documenter dans parametres-systeme.md.

Interdictions strictes identiques.

Livrable final : même format, "## Agent D — Résumé".
```

- [ ] **Step 2: Attendre les 4 rapports**

Les 4 agents tournent en parallèle. Quand les 4 sont revenus, vérifier que chaque rapport contient les 4 sections (Modifiés, Créés, Inchangés, À signaler en Phase 3).

- [ ] **Step 3: Vérifier qu'aucun code source n'a été modifié**

Run: `git status -s -- src/ prisma/ scripts/ docker/ public/ package.json next.config.ts tsconfig.json`
Expected: aucun fichier listé. Si quelque chose apparaît, c'est une violation des consignes — investiguer et annuler avec `git restore`.

- [ ] **Step 4: Vérifier que docs/superpowers/ n'a pas été modifié**

Run: `git status -s -- docs/superpowers/`
Expected: aucun fichier listé (sauf éventuellement le spec et ce plan, qui sont OK).

- [ ] **Step 5: Lister les fichiers .md effectivement touchés**

Run: `git status -s -- README.md docs/`
Inspecter visuellement la liste pour s'assurer qu'elle correspond aux périmètres annoncés.

- [ ] **Step 6: Pas de commit à cette étape**

Le commit final ne sera fait que par le user après revue.

---

## Task 3: Phase 3 — Dispatcher l'agent intégrateur

**Files:**
- Modify: `README.md`, `docs/README.md`, `docs/architecture.md`, `docs/base-de-donnees.md`, `docs/installation.md`, `docs/api/README.md`, `docs/guide-utilisateur/README.md`
- Create: `docs/.audit-report-2026-05-28.md`
- Delete: `docs/.audit-inventory.md`

- [ ] **Step 1: Dispatcher l'agent intégrateur**

Dispatcher un agent `subagent_type: "general-purpose"` avec le prompt ci-dessous. Inclure dans le prompt les 4 rapports complets reçus en Task 2 (concaténés).

```
Tu es l'agent intégrateur d'un audit de documentation pour /Users/amadou/Devs/projects/badge.

Tu interviens après que 4 agents parallèles ont mis à jour la doc par domaine. Voici leurs rapports complets :

<<< COLLER ICI LES 4 RAPPORTS A/B/C/D INTÉGRALEMENT >>>

Ta mission :

1. Lire docs/.audit-inventory.md pour le contexte global du code.

2. Mettre à jour les docs transverses suivantes en t'appuyant sur l'inventaire et les changements effectués par les agents A/B/C/D :
   - README.md (racine) : vérifier que la liste des fonctionnalités, stack, variables d'env et commandes correspondent au code réel.
   - docs/README.md : index général.
   - docs/architecture.md : architecture actuelle (Next.js App Router, Prisma, NextAuth JWT, structure src/).
   - docs/base-de-donnees.md : modèles Prisma actuels, relations, enums (notamment ActivityType complet, RegistrationStatus).
   - docs/installation.md : étapes d'installation Docker et sans Docker, variables d'env.
   - docs/api/README.md : index des endpoints (intégrer les nouveaux fichiers créés par A/B/C/D).
   - docs/guide-utilisateur/README.md : index utilisateur (intégrer les nouveaux fichiers).

3. Mettre à jour les index pour intégrer tout nouveau fichier créé en Phase 2 (signalé dans les sections "À signaler en Phase 3" des rapports).

4. Vérifier la cohérence inter-domaines :
   - Liens markdown internes : tous les [texte](chemin.md) pointent vers un fichier existant.
   - Terminologie homogène : utiliser systématiquement les mêmes mots pour les mêmes concepts (ex: "inscription" et pas "enregistrement", "scan" et pas "scanning", "approbation" et pas "validation"). Si des incohérences existent, harmoniser dans les docs transverses (pas dans les docs des autres agents — juste signaler).
   - Pas de référence à du code/fonctionnalité supprimée.

5. Compiler le rapport final docs/.audit-report-2026-05-28.md selon ce template exact :

# Rapport d'audit de la documentation - 2026-05-28

## Résumé exécutif

- Fichiers modifiés : N
- Fichiers créés : M
- Fichiers inchangés (vérifiés conformes) : K
- Total docs auditées : N+M+K

## Détail par agent

### Agent A — Auth, Utilisateurs, Équipes & Profil
<<< rapport complet de l'agent A >>>

### Agent B — Inscriptions, Badges & Fichiers
<<< rapport complet de l'agent B >>>

### Agent C — Scan & Catégories
<<< rapport complet de l'agent C >>>

### Agent D — Événement, Paramètres, Journal & Tableau de bord
<<< rapport complet de l'agent D >>>

### Phase 3 — Docs transverses
- <chemin> : <raisons en 1 ligne>
...

## Points d'attention pour revue

- Incohérences terminologiques résolues (avant/après)
- Suggestions de re-structure (le cas échéant)
- Divergences notables détectées entre code et doc historique
- Fonctionnalités du code que tu n'arrives pas à classer / documenter

## Fonctionnalités non documentées (gaps résiduels)

Liste de tout ce qui reste sans doc, avec recommandation.

6. Supprimer docs/.audit-inventory.md (fichier temporaire, plus utile).

Interdictions strictes :
- Aucune modification de code source.
- Aucune modification de docs/superpowers/.
- Pas de git commit (le user reviewra).

Livrable final : retourne le chemin du rapport et un résumé en 10 lignes max pour le user.
```

- [ ] **Step 2: Vérifier le rapport final**

Run: `ls -la docs/.audit-report-2026-05-28.md && wc -l docs/.audit-report-2026-05-28.md`
Expected: fichier existe et fait au moins 50 lignes.

- [ ] **Step 3: Vérifier que l'inventaire temporaire a bien été supprimé**

Run: `ls docs/.audit-inventory.md 2>/dev/null && echo "ENCORE PRESENT" || echo "OK supprimé"`
Expected: `OK supprimé`. Si encore présent, le supprimer avec `rm docs/.audit-inventory.md`.

- [ ] **Step 4: Vérifier l'intégrité des liens internes**

Run:
```bash
grep -rEo '\]\(([^)]+\.md[^)]*)\)' README.md docs/ --include='*.md' 2>/dev/null \
  | grep -v 'docs/superpowers/' \
  | sed -E 's/.*\]\(([^)#]+)[^)]*\)/\1/' \
  | sort -u \
  | while read link; do
      if [[ "$link" == http* ]]; then continue; fi
      # résolution relative ignorée pour simplicité — listing brut
      echo "$link"
    done | head -30
```

Inspecter visuellement pour repérer les liens cassés évidents (chemin pointant vers fichier non existant). Si beaucoup de liens cassés, demander à l'agent intégrateur de corriger.

- [ ] **Step 5: Présenter le diff complet au user**

Run: `git status -s -- README.md docs/`

Puis afficher au user :
- Le résumé exécutif du rapport (extrait des 20 premières lignes).
- Les commandes pour qu'il revue :
  - `git diff README.md docs/` pour voir tous les changements
  - `cat docs/.audit-report-2026-05-28.md` pour le rapport complet
- Demander si on doit committer, ajuster, ou annuler.

- [ ] **Step 6: Ne PAS committer**

Attendre la décision du user. Aucun git add / git commit à cette étape, quoi qu'il arrive. Le user décide.

---

## Self-Review

**Spec coverage check :**
- Phase 1 inventaire couvre toutes les sections demandées dans la spec (routes, endpoints, Prisma, permissions, env, libs, composants, logique non triviale, inventaire docs, gaps). ✓
- Phase 2 dispatche 4 agents en parallèle, périmètres alignés sur le tableau de la spec. ✓
- Phase 3 met à jour les docs transverses listées (README, docs/README, architecture, base-de-donnees, installation, indices), vérifie la cohérence, produit le rapport, supprime l'inventaire temporaire. ✓
- Garde-fous (pas de modif code, pas de modif superpowers, pas de commit auto, langue/style préservés) répétés dans chaque prompt d'agent. ✓
- Critères de succès vérifiés par les Steps de vérification (fichiers existent, code non modifié, inventaire supprimé). ✓
- Livrables : docs mises à jour + rapport final + pas de commit auto. ✓

**Placeholder scan :** Aucun "TBD", "TODO", "implement later". Le seul placeholder est `<<< COLLER ICI LES 4 RAPPORTS A/B/C/D INTÉGRALEMENT >>>` qui est une instruction explicite d'opérateur, pas un trou. ✓

**Type consistency :** Pas de types/signatures (pas de code). Cohérence des chemins : agents A/B/C/D ont des périmètres disjoints (vérifié manuellement contre le tableau de la spec). ✓
