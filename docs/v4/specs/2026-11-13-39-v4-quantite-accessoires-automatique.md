# Spec v4 — Quantité automatique des accessoires (spec 39)

> **Statut** : validée — 2026-11-13
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

La quantité de chaque accessoire choisi est **égale au nombre de badges** de la commande,
calculée automatiquement.

## Comportement

- Nombre de badges de référence : commande **en amont** = nombre de badges sélectionnés ;
  commande **sur place** = quantité estimée saisie.
- À l'étape « Accessoires », chaque accessoire coché affiche sa quantité = ce nombre, en
  lecture seule (même rendu que le support, `quantityLocked`), avec la mention « Calculée
  sur le nombre de badges ».
- Si l'organisateur revient modifier la sélection de badges ou la quantité estimée, les
  quantités des accessoires suivent.
- L'envoi (`products` de la demande) porte cette quantité ; **le serveur la recalcule** et
  ignore une quantité d'accessoire différente envoyée par le client (validation dans
  `src/lib/print-catalog/input.ts` ou le service de demande) *(arbitrage de l'agent :
  la règle vaut aussi pour un appel API direct)*.
- Les demandes existantes (brouillons compris) ne sont pas modifiées ; un brouillon rouvert
  est recalculé à l'enregistrement suivant.
- Le staff, à l'édition du devis, garde la main sur les lignes (inchangé).

## Fichiers

- Lot 2b : `src/components/event/print/PrintRequestWizard.tsx` et ses sous-composants
  d'étape, e2e de l'assistant.
- Socle : la règle serveur (quantité d'accessoire = nombre de badges) dans
  `src/lib/print-requests/content.ts` (enregistrement des produits d'une demande), fichier
  appartenant au lot plateforme ; posée par le socle pour que 2b n'ait pas à y toucher.

## Non-objectifs

Pas de ratio configurable par accessoire (un accessoire par badge, toujours).
