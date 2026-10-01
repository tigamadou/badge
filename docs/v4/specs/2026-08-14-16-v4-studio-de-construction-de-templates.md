# Spec v4 — Studio de construction de templates de badge

> **Statut** : conception validée — 2026-08-14 — **à implémenter**
> **Type** : outil de développement (service séparé, non déployé)
> **Périmètre** : v4
> **Dépend de** : [`2026-08-11-10-…format-et-moteur-de-templates-declaratifs`](2026-08-11-10-v4-format-et-moteur-de-templates-declaratifs.md) et [`2026-08-11-14-…apercu-image-et-generation-de-template`](2026-08-11-14-v4-apercu-image-et-generation-de-template.md)
> **Source** : demande utilisateur du 2026-08-14

## Contexte et objectifs

Construire un template consiste aujourd'hui à écrire un `manifest.json` à l'aveugle. La
boucle complète est : `make new-badge-template`, édition du manifeste dans un éditeur de
texte, `make pack-badge-template`, téléversement de l'archive sur
`/platform/badge-templates`, installation — et c'est seulement là, au PDF d'épreuve, que
l'on voit le résultat. Chaque ajustement de deux millimètres repasse par cette boucle.

Le format déclaratif rend pourtant le rendu instantané possible : `renderProof()`
(`src/lib/badge-templates/render-proof.tsx`) rend un manifeste et ses ressources avec un
contexte de démonstration, sans rien installer ni écrire en base. Il ne manque qu'une
surface pour l'appeler pendant l'édition.

Cette spec ajoute un **studio** : un service HTTP séparé, lancé en développement à côté de
l'application, où l'on édite le manifeste d'un template de l'atelier et où l'aperçu se
rafraîchit à mesure.

## Décisions tranchées

| Sujet | Décision | Pourquoi |
|---|---|---|
| Nature du service | **Service séparé de l'application principale** | Arbitrage utilisateur du 2026-08-14. Le studio n'a rien à faire dans l'application : il ne sert aucun utilisateur final, et l'y loger obligerait à garder une surface d'édition derrière une garde de rôle en production. |
| Cycle de vie | **Développement local uniquement** | Arbitrage utilisateur du 2026-08-14. Ni déploiement, ni authentification, ni stockage serveur : le studio lit et écrit l'atelier sur le disque monté dans le conteneur. |
| Technologie | **Serveur Node minimal lancé par `tsx`**, page HTML/CSS/JS sans framework | L'interface se résume à une liste, une zone de texte, un sélecteur et un cadre d'aperçu. Une seconde application Next imposerait un `package.json`, un build et une configuration Yarn PnP à démêler pour un outil de développement. `tsx` compile déjà le TSX pour les scripts de `scripts/`. |
| Édition | **Manifeste JSON en texte brut** | Arbitrage utilisateur du 2026-08-14. Le JSON reste la source de vérité du format déclaratif ; des formulaires par bloc ou un canevas de manipulation directe sont un autre produit, à décider séparément. |
| Rendu | **Le PDF réel, par le moteur de `renderProof()`** | La documentation pose le PDF d'épreuve comme la preuve qu'un template s'imprime. Une reconstitution HTML serait plus rapide mais créerait un second moteur de rendu, donc deux vérités et des écarts silencieux. `renderProof()` fixant `SAMPLE_CONTEXT`, le studio réutilise son `assetsToResolver()` et le même enchaînement `buildDeclarativeTemplate()` → `renderToBuffer()`, avec le contexte de la variante choisie. |
| Source du rendu | Le **texte de l'éditeur**, pas le fichier sur disque | On veut voir l'effet d'une modification avant de l'enregistrer. L'écriture disque reste une action explicite. |
| Jeux de données | **Cinq variantes commutables** | Arbitrage utilisateur du 2026-08-14. Un manifeste se casse sur les `visibleIf` et les débordements : il faut pouvoir rendre le cas sans photo, la catégorie anonyme, le badge neutre et les textes très longs. |
| Photo et QR de l'aperçu | **Réellement produits** dans les variantes du studio | `SAMPLE_CONTEXT` laisse `photoDataUrl` et `qrCodeDataUrl` vides ; sans image ni QR, ni le cadrage, ni `radiusMm`, ni les conditions portant sur la photo ne sont observables. |
| Atelier | `badge-templates/` à la racine, inchangé | C'est déjà le dossier de `make new-badge-template`, déjà gitignoré. En introduire un second sèmerait la confusion avec `prisma/badge-templates/`. |
| Exposition réseau | Port publié **et** `studio.badge.local` via Caddy | Le service n'écoute que sur le réseau Docker de développement ; l'entrée Caddy suit la convention des autres outils (`pma.`, `mail.`, `s3.`). |

### Alternatives écartées

| Alternative | Statut | Raison |
|---|---|---|
| Commande locale `make preview-badge-template` produisant un fichier d'aperçu | Non retenue | Écartée le 2026-08-14 au profit d'une interface web. Resterait une boucle « lancer, ouvrir le fichier », sans variantes commutables. |
| Aperçu au moment du téléversement, avant confirmation d'installation | Non retenue | Ne raccourcit pas la boucle d'édition, qui est le problème posé. |
| Seconde application Next dans le dépôt | Non retenue | Configuration disproportionnée pour quatre écrans d'un outil de développement. |
| Application Vite + React | Non retenue | Exigerait malgré tout un serveur Node à côté pour `@react-pdf`, donc deux processus et une dépendance de plus. |
| Éditeur par formulaires ou manipulation directe sur canevas | Non retenue **pour cette spec** | C'est un produit distinct, à spécifier séparément si le besoin se confirme après usage de l'éditeur JSON. |
| Corriger `SAMPLE_CONTEXT` pour que les épreuves du catalogue portent photo et QR | Hors périmètre | Constat posé ici, décision non prise : les épreuves déjà installées ne seraient pas rerendues, ce qui demande son propre arbitrage. |

## Architecture cible

### Fichiers

```
studio/
  server.ts      — serveur HTTP : aiguillage des routes, service des fichiers statiques
  workshop.ts    — acces a l'atelier : validation du nom, liste, lecture, ecriture
  render.ts      — validation du manifeste et rendu PDF
  contexts.ts    — variantes de contexte d'apercu
  public/
    index.html
    app.js
    styles.css
  __tests__/
```

Le serveur n'est qu'un aiguillage : toute la logique vit dans trois modules sans
dépendance à HTTP, ce qui les rend testables par appel direct plutôt que par socket.

Le service tourne dans un conteneur bâti sur `Dockerfile.dev`, avec le dépôt monté sur
`/app` — exactement comme le service `app`. Il importe le moteur par chemin relatif
(`../src/lib/badge-templates/…`), comme le font déjà `scripts/pack-badge-template.ts` et
`scripts/validate-badge-templates.ts`.

Trois fichiers d'infrastructure évoluent :

- `docker-compose.dev.yml` : service `studio`, commande `yarn tsx studio/server.ts`,
  port `3900` interne publié sur `3786` ;
- `Caddyfile.dev` : `studio.badge.local` vers `studio:3900` ;
- `Makefile` : cible `studio` (démarrage) et mention dans l'aide.

### Points d'entrée HTTP

| Route | Corps / réponse |
|---|---|
| `GET /`, `/app.js`, `/styles.css` | la page et ses ressources statiques |
| `GET /api/variants` | `{ variants: Array<{ id: string; label: string }> }` — les jeux de données proposés |
| `GET /api/templates` | `{ templates: Array<{ name: string; hasManifest: boolean }> }` — les dossiers de l'atelier |
| `GET /api/templates/:name` | `{ manifest: string; assets: string[] }` — le manifeste **en texte brut**, et les fichiers présents dans `assets/` et `fonts/` |
| `PUT /api/templates/:name` | corps `{ manifest: string }` → écrit `manifest.json`, réponse `{ ok: true }` ou `{ ok: false, errors: string[] }` |
| `POST /api/render` | corps `{ name: string; manifest: string; variant: string }` → `200` avec le PDF (`application/pdf`), ou `422` avec `{ errors: string[] }` |

`POST /api/render` rend le **texte reçu**, pas le fichier : c'est ce qui permet de voir une
modification avant de l'enregistrer. Il enchaîne `JSON.parse`, `parseManifest()` — avec la
liste réelle des ressources du dossier, pour que le manifeste soit validé contre ce qui
existe — puis `renderProof()`.

Les ressources du dossier sont typées par `sniff()`, la fonction de `package-reader.ts`
qui déduit le type des **octets d'en-tête** — promue d'interne à exportée pour l'occasion.
Déduire le type de l'extension serait plus court, mais rendrait le studio plus permissif
que l'installation : un WebP renommé `.png` s'afficherait au studio et serait refusé au
téléversement, ce qui est précisément le genre d'écart que cet outil doit éviter.

Les noms de template sont validés par le motif de `scripts/new-badge-template.ts`
(`^[a-z0-9]+(-[a-z0-9]+)*$`), ce qui exclut par construction toute remontée de chemin. Un
nom non conforme ou un dossier absent renvoie `404`.

### Interface

Deux colonnes.

À gauche : la liste des templates de l'atelier, la zone d'édition du manifeste, et sous
elle un bandeau d'erreurs affichant les messages de `parseManifest()`, un par ligne.

À droite : le sélecteur de variante et l'aperçu — le PDF dans un `<object>`.

Le rendu part 600 ms après la dernière frappe, et à chaque changement de variante ou de
template. L'enregistrement sur disque est explicite : un bouton, plus `Ctrl/Cmd+S`.

Un manifeste invalide **n'efface pas l'aperçu** : le bandeau signale l'erreur et le dernier
rendu valide reste affiché. Sans cette règle, l'aperçu disparaîtrait à chaque frappe
intermédiaire — dès la première accolade ouverte.

### Variantes de contexte

`studio/contexts.ts` exporte une liste ordonnée de `{ id, label, ctx }` :

| Variante | Ce qu'elle exerce |
|---|---|
| Participant complet | le cas nominal : photo, QR, catégorie colorée |
| Sans photo | le repli des blocs conditionnés par `participant.photoDataUrl` |
| Catégorie anonyme | les blocs conditionnés par `category.anonymous` |
| Badge neutre | les blocs conditionnés par `category.neutralBadge` |
| Textes très longs | les modes de débordement `clip`, `truncate` et `shrink` |

Le QR est produit par `generateQRCodeDataURL()` (`src/lib/qrcode.ts`, dépendance déjà
présente). La photo est une image PNG de démonstration, en data URL constante dans le
module : aucun fichier binaire n'entre au dépôt, et deux exécutions donnent le même rendu.

## Tests

`studio/` est hors du périmètre de couverture — `vitest.config.ts` ne mesure que
`src/lib/**` et `src/app/api/**` — mais les tests placés dans `studio/__tests__/` sont bien
exécutés par `make test`, l'exclusion ne visant que `e2e/**`.

- **Validation du nom de template** : accepte `salon-2027`, refuse `../escape`, `Salon`,
  la chaîne vide et `a--b`.
- **Variantes** : les cinq identifiants attendus sont présents ; la variante « participant
  complet » porte un QR et une photo non vides ; la variante « sans photo » a bien une
  `photoDataUrl` vide ; un identifiant inconnu est rejeté.
- **Rendu** : un manifeste minimal valide produit un tampon commençant par `%PDF` ; un
  manifeste au JSON illisible et un manifeste sémantiquement invalide produisent chacun
  des erreurs et aucun rendu.

L'interface elle-même n'est pas testée automatiquement : c'est un outil de développement
local, non déployé, et la politique de tests ne couvre pas les composants d'interface en
unitaire. Sa vérification passe par l'usage.

## Documentation impactée

- `docs/v4/features/templates-badges.md` — la section « Créer un template » décrit la
  nouvelle boucle : `make new-badge-template`, `make studio`, édition avec aperçu,
  `make pack-badge-template`.
- `docs/v4/installation.md` — le tableau des services de développement gagne une ligne
  `studio` (port, URL Caddy).
- `CLAUDE.md` — le tableau des services et celui des commandes `make`.
