# Spec v4 — Quantité automatique des accessoires (spec 39)

> **Statut** : implémentée — 2026-11-13 (PR ouverte, branche `feat/roles-imprimeur-support`), validée — 2026-11-13, révisée le 2026-11-13 (quantité plafonnée, non imposée)
> **Type** : amélioration UI + règle de calcul
> **Périmètre** : v4 — assistant de commande d'impression de l'organisateur
> **Source** : `Todo.md` du 2026-11-12 (item 4)
> **Coordination** : [`2026-11-13-36-v4-chantier-roles-docs-coordination.md`](2026-11-13-36-v4-chantier-roles-docs-coordination.md) — lot 2b

## Contexte

Dans `PrintRequestWizard` (`src/components/event/print/PrintRequestWizard.tsx`), l'étape
« Support » verrouille déjà la quantité du produit badge sur le nombre de badges
(`quantityLocked`). À l'étape « Accessoires », l'organisateur saisit librement une quantité
par accessoire (`cfg.quantity`).

## Objectif

La quantité de chaque accessoire choisi est **plafonnée au nombre de badges** de la commande.
Elle vaut ce nombre par défaut ; l'organisateur peut la baisser, jamais la dépasser.
*(Révision du 2026-11-13, décision de l'utilisateur : la première version imposait une quantité
égale au nombre de badges, en lecture seule.)*

## Comportement

- Nombre de badges de référence : commande **en amont** = nombre de badges sélectionnés ;
  commande **sur place** = quantité estimée saisie.
- À l'étape « Accessoires », chaque accessoire coché propose une quantité **modifiable**,
  préremplie avec le nombre de badges, bornée par `max = nombre de badges`. Une saisie
  supérieure est ramenée au nombre de badges (le champ ne permet pas de la conserver) et le
  bouton « Suivant » reste bloqué tant qu'une quantité dépasse ce plafond.
- Si la quantité saisie est **inférieure** au nombre de badges, un message d'alerte s'affiche
  sous l'accessoire : « Quantité inférieure au nombre de badges de la commande (N). »
  L'enregistrement reste possible.
- Le minimum de commande de l'accessoire (`minQuantity`) s'applique toujours. Un accessoire
  dont le minimum dépasse le nombre de badges **ne peut pas être choisi** : case désactivée,
  avec la mention « Minimum de M, supérieur au nombre de badges (N) ». *(Arbitrage de
  l'orchestrateur, conséquence du plafond.)*
- Si l'organisateur revient modifier la sélection de badges ou la quantité estimée : un
  accessoire dont la quantité égalait l'ancien nombre de badges suit le nouveau ; une quantité
  devenue supérieure au nouveau nombre est ramenée à ce nombre ; une quantité inférieure est
  conservée. Même règle côté serveur (`followBadgeCount`).
- **Le serveur fait foi** (y compris pour un appel API direct) : il enregistre la quantité
  envoyée, refuse une quantité supérieure au nombre de badges (`400`,
  `ACCESSORY_QUANTITY_ABOVE_BADGES`, détails `{ productId, badgeCount }`), une quantité
  inférieure à 1 (`VALIDATION`) et une quantité sous `minQuantity` (`BELOW_MIN_QUANTITY`,
  inchangé). Une quantité absente vaut le nombre de badges.
- Les demandes existantes (brouillons compris) ne sont pas modifiées ; un brouillon rouvert
  reprend ses quantités, ramenées au nombre de badges si elles le dépassent.
- Le staff, à l'édition du devis, garde la main sur les lignes (inchangé).

## Fichiers

- Lot 2b : `src/components/event/print/PrintRequestWizard.tsx` et ses sous-composants
  d'étape, e2e de l'assistant.
- Socle : la règle serveur (quantité d'accessoire plafonnée au nombre de badges, suivi par
  `followBadgeCount`) dans
  `src/lib/print-requests/content.ts` (enregistrement des produits d'une demande), fichier
  appartenant au lot plateforme ; posée par le socle pour que 2b n'ait pas à y toucher.

## Non-objectifs

Pas de ratio configurable par accessoire (au plus un accessoire par badge).
