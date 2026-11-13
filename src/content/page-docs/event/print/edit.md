---
route: /event/[eventId]/print/[requestId]/edit
title: Modifier une commande d'impression
audience: organisateur
access: print.request
sources:
  - src/app/event/[eventId]/print/[requestId]/edit/page.tsx
  - src/components/event/print/BadgeSelectionStep.tsx
  - src/components/event/print/PrintRequestWizard.tsx
  - src/components/event/print/accessory-quantity.ts
  - src/components/event/print/guard.ts
  - src/components/event/print/selection.ts
  - src/components/print/ProductCard.tsx
  - src/components/print/ProductConfigurator.tsx
  - src/components/print/ProductGallery.tsx
  - src/components/print/QuoteLinesTable.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/FileBox.tsx
  - src/components/ui/FormControls.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Input.tsx
  - src/components/ui/RadioCards.tsx
  - src/components/ui/Select.tsx
  - src/components/ui/Stepper.tsx
  - src/components/ui/TableFrame.tsx
  - src/components/ui/Toolbar.tsx
sourceHash: sha256:2e72914bc0f4a847979bd0c3561d0e338f72706207a4fdf2f8bfa7e987e23a6e
updatedAt: 2026-11-13
---

## À quoi sert cet écran

L'assistant guide la préparation d'une commande d'impression, du choix des badges à l'envoi. Il sert aussi bien à compléter un brouillon qu'à modifier une commande déjà envoyée ou au stade du devis. Le lien en haut (la référence de la commande) ramène à son détail.

La modification n'est possible que pour une commande au statut Brouillon, Envoyée ou Devis envoyé, sur un évènement non archivé, et pas pour le staff en consultation. Sinon, vous revenez au détail de la commande. Si le chargement échoue : « Impossible de charger la commande. Rechargez la page. »

Le bandeau de progression indique les étapes : **Type**, **Badges** (**Quantité** pour une commande sur place), **Support**, **Accessoires**, **Remise**, **Récapitulatif**. **Suivant** enregistre l'étape et passe à la suivante ; **Précédent** revient en arrière.

## Étape Badges (commande en amont)

Choisissez les badges à imprimer :
- **Tous les badges disponibles** : toutes les inscriptions approuvées ;
- **Par catégorie** : cochez une ou plusieurs catégories (le nombre de badges disponibles est indiqué) ;
- **Sélection manuelle** : cochez les participants un par un, avec une zone de recherche (« Rechercher un participant ou une catégorie »). Un participant déjà inclus dans une autre commande est grisé avec la mention « Déjà dans » suivie de la référence ; la mention « Déjà imprimé » signale un badge déjà imprimé. Seuls les 200 premiers résultats sont affichés : affinez la recherche si besoin.

Le nombre de badges sélectionnés s'affiche en dessous. Il faut en sélectionner au moins un.

## Étape Quantité (commande sur place)

Saisissez le **Nombre de badges à imprimer sur place** (entier d'au moins 1).

## Étape Support

Choisissez le support du badge parmi ceux proposés par l'équipe Badge (carte avec photo, catégorie, prix « À partir de » et délai de fabrication). S'il n'y en a aucun : « Aucun support de badge n'est proposé pour le moment. » Un support déjà choisi qui n'est plus proposé est signalé et sera retiré de la commande.

Le support choisi s'ouvre dans un configurateur : ses options (liste de choix, cases à cocher, couleurs, texte, fichier à téléverser, répartition des quantités) sont expliquées par leurs libellés ; un astérisque marque les options obligatoires et un supplément éventuel est indiqué à côté du choix. Les fichiers acceptés sont JPEG, PNG, WebP ou PDF, 5 Mo maximum. La **Quantité** d'un support est verrouillée : elle est égale au nombre de badges. Un encadré donne le **Prix unitaire estimé** et le **Total estimé** ; ce n'est qu'une estimation, le prix définitif est fixé dans le devis.

## Étape Accessoires

Facultative. Cliquez sur les accessoires souhaités (cordons, porte-badges…) : chacun s'ouvre dans son configurateur. La **Quantité** d'un accessoire ne peut pas dépasser le nombre de badges ; si le nombre de badges change, une quantité égale à l'ancien nombre suit le nouveau. Un message prévient lorsque la quantité est inférieure au nombre de badges.

## Étape Remise

Pour une commande **en amont** :
- **Mode de remise** : **Retrait** (vous récupérez les badges auprès de l'équipe Badge) ou **Livraison** (à l'adresse indiquée, avec **Adresse de livraison**, **Nom du contact** et **Téléphone du contact**) ;
- **Date souhaitée (facultatif)**.

Pour une commande **sur place** :
- **Lieu d'impression**, **Nom du contact sur place** et **Téléphone du contact** ;
- **Créneaux de présence** : une date, une heure de début et une heure de fin par créneau ; **Ajouter un créneau** en ajoute un, **Retirer** supprime un créneau. Il faut au moins un créneau complet.

Dans les deux cas, **Remarques (facultatif)** (2 000 caractères maximum).

## Étape Récapitulatif

Le tableau reprend chaque ligne (libellé, options, quantité, prix unitaire, total) et le **Total estimé**, suivi du mode de remise ou du lieu sur place. Un message rappelle que le prix définitif est fixé par l'équipe Badge dans le devis. Si votre organisation dispose de crédit d'impression, une phrase indique le montant que l'équipe Badge pourra appliquer au devis.

Le bouton final est **Envoyer la commande** pour un brouillon (« Commande envoyée. »), ou **Enregistrer les modifications** pour une commande déjà envoyée (« Modifications enregistrées. »).
