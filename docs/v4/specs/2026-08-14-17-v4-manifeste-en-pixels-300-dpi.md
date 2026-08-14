# Spec v4 — Manifeste de template en pixels 300 dpi

> **Statut** : implémentée — 2026-08-14
> **Type** : changement de format (breaking, assumé avant tout déploiement v4)
> **Périmètre** : v4
> **Dépend de** : [`2026-08-11-10-…format-et-moteur-de-templates-declaratifs`](2026-08-11-10-v4-format-et-moteur-de-templates-declaratifs.md) et [`2026-08-14-16-…studio-de-construction-de-templates`](2026-08-14-16-v4-studio-de-construction-de-templates.md)
> **Source** : demande utilisateur du 2026-08-14

## Contexte et problème

Le format déclaratif exprimait toutes ses dimensions en **millimètres** (`widthMm`,
`heightMm`, `radiusMm`, coordonnées `x/y/w/h` interprétées en mm) et ses tailles
typographiques en **points** (`sizePt`, `minSizePt`, `borderTopPt`). Or l'auteur d'un
template travaille dans un outil de maquette (Photoshop, Figma) qui affiche des
**pixels** : chaque valeur reportée dans le studio exigeait une conversion manuelle
px → mm ou px → pt, source d'erreurs et de friction à chaque ajustement.

## Décision

Tout le manifeste passe en **pixels à 300 dpi** — 1 px = 1/300 pouce, soit
1 px = 0,24 pt PDF. Une carte CR80 paysage fait 1011 × 638 px. Les tailles de police
suivent la même unité (arbitrage utilisateur du 2026-08-14 : « tout en px y compris
les polices ») : `sizePx: 50` vaut 12 pt. `lineHeight` reste un multiplicateur sans
unité ; `letterSpacing` passe en px.

| Sujet | Décision | Pourquoi |
|---|---|---|
| Convention d'échelle | **300 dpi** (1 px = 1/300 pouce) | Arbitrage utilisateur du 2026-08-14, préféré au CSS 96 dpi : les maquettes print s'exportent à 300 dpi, leurs valeurs se reportent telles quelles. Le PDF garde sa taille physique exacte, la conversion vivant dans un unique helper `px()`. |
| Étendue | **Toutes** les valeurs dimensionnelles, polices comprises | Une seule unité dans tout le manifeste : l'auteur ne convertit jamais rien. |
| `formatVersion` | Reste `1` | La v4 n'est pas déployée ; aucun paquet externe n'existe. Tous les manifestes du dépôt (ateliers, paquets de référence `prisma/badge-templates/`) migrent dans le même changement. |
| Stockage BDD | `pageWidthMm`/`pageHeightMm` → `pageWidthPx`/`pageHeightPx` | La colonne suit l'unité du manifeste qu'elle recopie. Les lignes `InstalledBadgeTemplate` de dev (layouts mm devenus invalides) ont été purgées puis re-seedées — validé par l'utilisateur le 2026-08-14. |
| Affichage catalogue | `pageSize` en `"1011px"` et « 1011×638 px » | L'affichage recopie l'unité stockée ; maintenir un double affichage mm demanderait une conversion inverse sans besoin exprimé. |

### Alternatives écartées

| Alternative | Raison |
|---|---|
| CSS 96 dpi (1 px = 1/96 pouce, badge = 324 × 204 px) | Convention du web et de Figma, mais les maquettes de badge visées sont des exports print 300 dpi. |
| Canvas libre (page en px arbitraires + format physique déclaré à part) | Deux notions de taille à réconcilier, complexité sans bénéfice pour le cas d'usage. |
| Garder `sizePt` pour la typographie | Convention typographique classique, mais réintroduit une conversion pour l'auteur — contraire à l'objectif. |

## Conversion

- mm → px : × 300 / 25,4 ≈ × 11,811 (85,6 mm → 1011 px)
- pt → px : × 300 / 72 ≈ × 4,167 (12 pt → 50 px)
- Rendu (px → pt PDF) : × 0,24, centralisé dans `src/lib/badge-templates/px.ts`,
  qui remplace `mm.ts` (supprimé).

Les calculs de débordement (`shrink`, `truncate`) restent entièrement en px — largeur
du cadre et taille de police partagent désormais la même unité, la conversion en
points n'intervient qu'à l'émission du style `@react-pdf`.

## Fichiers touchés

Moteur : `manifest-types.ts`, `schema.ts`, `renderer.tsx`, `index.ts`, `px.ts` (nouveau),
`install.ts`, `resolve.ts` ; schéma Prisma (`InstalledBadgeTemplate`) ; scaffold
`scripts/new-badge-template.ts` ; les quatre manifestes du dépôt et leurs README ;
pages `/platform/badge-templates` ; tests correspondants ;
`docs/v4/features/templates-badges.md`.
