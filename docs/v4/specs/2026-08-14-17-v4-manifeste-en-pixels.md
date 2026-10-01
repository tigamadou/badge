# Spec v4 — Manifeste de template en pixels

> **Statut** : implémentée — 2026-08-14 (révisée le jour même : 300 dpi → 96 dpi)
> **Type** : changement de format (breaking, assumé avant tout déploiement v4)
> **Périmètre** : v4
> **Dépend de** : [`2026-08-11-10-…format-et-moteur-de-templates-declaratifs`](2026-08-11-10-v4-format-et-moteur-de-templates-declaratifs.md) et [`2026-08-14-16-…studio-de-construction-de-templates`](2026-08-14-16-v4-studio-de-construction-de-templates.md)
> **Source** : demandes utilisateur du 2026-08-14

## Contexte et problème

Le format déclaratif exprimait toutes ses dimensions en **millimètres** (`widthMm`,
`heightMm`, `radiusMm`, coordonnées `x/y/w/h` interprétées en mm) et ses tailles
typographiques en **points** (`sizePt`, `minSizePt`, `borderTopPt`). Or l'auteur d'un
template travaille dans un outil de maquette qui affiche des **pixels** : chaque
valeur reportée dans le studio exigeait une conversion manuelle, source d'erreurs et
de friction à chaque ajustement.

## Décision

Tout le manifeste passe en **pixels CSS à 96 dpi** — la convention de Figma et du
web : 1 px = 1/96 pouce, soit 0,75 pt PDF. Une carte CR80 paysage fait
323,53 × 204,09 px. Les tailles de police suivent la même unité (arbitrage
utilisateur : « tout en px y compris les polices ») : `sizePx: 16` vaut 12 pt.
`lineHeight` reste un multiplicateur sans unité ; `letterSpacing` passe en px.

| Sujet | Décision | Pourquoi |
|---|---|---|
| Convention d'échelle | **96 dpi** (1 px = 1/96 pouce) | Les maquettes de badge du projet sont dessinées dans **Figma**, qui travaille en px CSS : leurs valeurs se copient telles quelles dans le manifeste (un cadre Figma de 317,48 × 453,54 px se déclare à l'identique et imprime en 84 × 120 mm). Une première version le jour même avait retenu 300 dpi (convention des exports print) ; elle a été renversée dès la première confrontation à une maquette réelle. |
| Étendue | **Toutes** les valeurs dimensionnelles, polices comprises | Une seule unité dans tout le manifeste : l'auteur ne convertit jamais rien. |
| `formatVersion` | Reste `1` | La v4 n'est pas déployée ; aucun paquet externe n'existe. Tous les manifestes du dépôt (ateliers, paquets de référence `prisma/badge-templates/`) migrent dans le même changement. |
| Stockage BDD | `pageWidthMm`/`pageHeightMm` → `pageWidthPx`/`pageHeightPx` | La colonne suit l'unité du manifeste qu'elle recopie. Les lignes `InstalledBadgeTemplate` de dev (layouts à l'ancienne unité, invalides) sont purgées puis re-seedées à chaque bascule — validé par l'utilisateur le 2026-08-14. |
| Affichage catalogue | `pageSize` en `"323.53px"` et « 323.53×204.09 px » | L'affichage recopie l'unité stockée ; maintenir un double affichage mm demanderait une conversion inverse sans besoin exprimé. |

### Alternatives écartées

| Alternative | Raison |
|---|---|
| Print 300 dpi (1 px = 1/300 pouce, CR80 = 1011 × 638 px) | Retenue quelques heures puis renversée : la source des maquettes est Figma (96 dpi), pas des exports Photoshop 300 dpi — les valeurs Figma auraient exigé une multiplication par 3,125. |
| CSS 96 dpi… en nombre entiers de mm ronds | Sans objet : les valeurs Figma sont la référence, décimales comprises (le schéma accepte les nombres non entiers). |
| Canvas libre (page en px arbitraires + format physique déclaré à part) | Deux notions de taille à réconcilier, complexité sans bénéfice pour le cas d'usage. |
| Garder `sizePt` pour la typographie | Convention typographique classique, mais réintroduit une conversion pour l'auteur — contraire à l'objectif. |

## Conversion

- mm → px : × 96 / 25,4 ≈ × 3,7795 (85,6 mm → 323,53 px)
- pt → px : × 96 / 72 = × 4/3 (12 pt → 16 px)
- Rendu (px → pt PDF) : × 0,75, centralisé dans `src/lib/badge-templates/px.ts`,
  qui remplace `mm.ts` (supprimé).

Les calculs de débordement (`shrink`, `truncate`) restent entièrement en px — largeur
du cadre et taille de police partagent la même unité, la conversion en points
n'intervient qu'à l'émission du style `@react-pdf`.

## Découverte associée : cadres texte trop bas

`@react-pdf` **supprime silencieusement** un bloc `Text` dont le conteneur à hauteur
fixe est plus bas que sa ligne (pas de rognage, pas d'erreur). Avec Montserrat, le
seuil observé est ≈ 1,4 × la taille de police. Les manifestes migrés garantissent
désormais **h ≥ 1,45 × sizePx** par ligne, et la règle est documentée dans la doc
feature et le README du scaffold. Plusieurs blocs des templates de référence
(nom/structure d'`ex-305v`, titre d'événement et catégorie du badge `default`)
étaient sous ce seuil depuis l'ère millimètres et n'apparaissaient pas au rendu.

## Fichiers touchés

Moteur : `manifest-types.ts`, `schema.ts`, `renderer.tsx`, `index.ts`, `px.ts` (nouveau),
`install.ts`, `resolve.ts` ; schéma Prisma (`InstalledBadgeTemplate`) ; scaffold
`scripts/new-badge-template.ts` ; les manifestes du dépôt et leurs README ;
pages `/platform/badge-templates` ; tests correspondants ;
`docs/v4/features/templates-badges.md`.
