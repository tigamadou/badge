---
route: /platform/print/orders/[requestId]
title: Commande d'impression
audience: staff
access: print.requests.read
sources:
  - src/app/platform/page-guard.ts
  - src/app/platform/print/orders/[requestId]/page.tsx
  - src/components/admin/PaymentHistory.tsx
  - src/components/layout/FullHeightPage.tsx
  - src/components/payments/status.ts
  - src/components/print/OnsiteTemplateAlert.tsx
  - src/components/print/OrderBadgesDialog.tsx
  - src/components/print/OrderModal.tsx
  - src/components/print/OrderTabs.tsx
  - src/components/print/OrgPrintCreditCard.tsx
  - src/components/print/PrintRequestStatusBadge.tsx
  - src/components/print/PrintThread.tsx
  - src/components/print/QuoteMessageCard.tsx
  - src/components/print/QuoteTotals.tsx
  - src/components/print/RelatedRequestLinks.tsx
  - src/components/print/entry-tone.ts
  - src/components/print/quote-message.ts
  - src/components/print/useIsWide.ts
  - src/components/staff/print/ApplyCreditDialog.tsx
  - src/components/staff/print/OnsiteRequestPanel.tsx
  - src/components/staff/print/OrderSheetPanel.tsx
  - src/components/staff/print/QuoteEditor.tsx
  - src/components/staff/print/RequestCreditPanel.tsx
  - src/components/staff/print/RequestDetail.tsx
  - src/components/staff/print/RequestStatusActions.tsx
  - src/components/staff/print/order/OrderBadgesButton.tsx
  - src/components/staff/print/order/OrderComposer.tsx
  - src/components/staff/print/order/OrderConversation.tsx
  - src/components/staff/print/order/OrderQuoteColumn.tsx
  - src/components/staff/print/order/OrderSummaryColumn.tsx
  - src/components/staff/print/order/order-thread.ts
  - src/components/staff/print/request-actions.ts
  - src/components/staff/print/request-fetch.ts
  - src/components/staff/print/request-types.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Dialog.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Table.tsx
sourceHash: sha256:786d030936f299f7245a830990a7cc53a170b25718d804289ad6da44c261c01e
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cette page suit une commande d'impression de bout en bout : résumé, échanges avec l'organisateur, devis et passage d'un statut à l'autre. Le lien **Commandes** en haut ramène à la liste. L'en-tête montre la référence et le statut de la commande. Les boutons proposés dépendent du statut de la commande et de vos droits : un bouton que vous n'avez pas le droit d'utiliser n'est pas affiché. Si la commande est introuvable ou inaccessible, l'écran l'indique.

Sur grand écran, la page a trois colonnes (résumé, fil, devis) ; sur petit écran, trois onglets : **Infos**, **Discussion** et **Devis**.

## Les statuts

Envoyée, Devis envoyé, Devis accepté, Payée, En production, Prête, Terminée, Refusée, Annulée. Le cheminement normal est : Envoyée, Devis envoyé, Devis accepté, Payée, En production, Prête, Terminée.

## Le résumé (colonne **Infos**)

Le statut et le type de commande (**En amont** ou **Pendant l'évènement**), des liens vers la commande principale (« Complément de … ») ou les commandes complémentaires, puis :
- **Badges** : le nombre de badges (ou la quantité estimée).
- **Livraison** (commande en amont : Livraison ou Retrait, adresse, contact) ou **Sur place** (lieu et contact).
- Le volet repliable **Détails** : **Impression** (Recto-verso ou Recto seul), **Template** et format du badge, **Date souhaitée**, **Envoyée le**, **Total du devis**, **Total accepté** et **Remarques**.

Pour une commande en amont, le bouton **Voir les badges (N)** en haut de la page ouvre la liste des badges de la commande (**Badges de la commande**, avec recherche par nom, catégorie, statut et marquage « imprimé »).

## Le fil de discussion

Le fil affiche les messages de l'organisateur et de l'équipe, les évènements de la commande (au centre), les cartes de devis et les notes internes (fond ambré, mention « Note interne », invisibles de l'organisateur). Il se met à jour automatiquement et marque les messages comme lus à l'ouverture. « Aucun échange pour le moment. » s'il est vide ; **Nouveaux messages** apparaît quand de nouveaux messages arrivent plus bas.

:::permission print.requests.messages.send
## Écrire dans le fil

Sous le fil, la zone « Écrire à l'organisateur… » permet d'envoyer un message (5 000 caractères au plus) :
- **Note interne** : cochée, le message devient une note visible du staff seulement (« Note interne, invisible de l'organisateur… »), et le bouton devient **Ajouter la note** ; sinon le bouton est **Envoyer**.
- **Joindre un fichier** : image JPEG, PNG, WebP ou PDF ; **Retirer** enlève la pièce jointe avant l'envoi.
:::

## Le devis

La colonne **Devis** affiche l'**Organisation**, l'**Évènement** et le **Contact** de l'organisation, puis le total estimé avec le nombre de lignes et de badges.

:::permission print.requests.quote.edit
## Modifier le devis

Tant que la commande est **Envoyée** ou **Devis envoyé**, le bouton **Modifier le devis** ouvre le devis, avec les colonnes **Intitulé**, **Qté**, **Prix unitaire** et **Total**. Modifiez une valeur puis quittez le champ pour l'enregistrer ; chaque ligne peut être retirée. **Ajouter une ligne** propose :
- **Type** : **Produit**, **Service**, **Remise** ou **Ligne libre**.
- **Produit** (pour le type Produit) : un produit du catalogue, qui préremplit intitulé et prix.
- **Intitulé** (200 caractères au plus), **Quantité** et **Prix unitaire** (pour une remise : **Montant (FCFA)**, saisi en positif et déduit du total).

Dans les autres statuts, le devis est en lecture seule (« Lecture seule dans cet état. »).
:::

## Faire avancer la commande

Les boutons de statut en haut de la page dépendent du statut actuel :

:::permission print.requests.quote.send
- **Envoyer le devis** (commande Envoyée) : transmet le devis à l'organisateur (« Devis envoyé. »).
:::

:::permission print.requests.reject
- **Refuser** (commande Envoyée ou Devis envoyé) : demande un motif de 3 caractères au moins, transmis à l'organisateur (« Commande refusée. »).
:::

:::permission print.requests.reopen
- **Rouvrir le devis** (commande Devis accepté) : repasse la commande en révision (« Devis rouvert. »).
:::

:::permission print.requests.mark_paid
- **Marquer payée** (commande Devis accepté) : pour un paiement reçu hors FedaPay (virement, espèces). Un motif de 3 caractères au moins est obligatoire. Refusé si un paiement FedaPay est en cours (« Un paiement FedaPay est en cours sur cette commande. »).
:::

:::permission print.requests.advance
- **Passer en production** (commande Payée), **Marquer prête** (En production) et **Terminer** (Prête) pour une commande en amont. Pour une commande en amont qui compte encore des badges non marqués, **Terminer** demande « Marquer les N badges comme imprimés ? » : **Oui** marque ces badges (les participants sont prévenus ; si le marquage échoue, la commande reste terminée), **Non** termine seulement la commande.
:::

:::permission print.requests.onsite.complete
- **Terminer** pour une commande sur place (statut Prête) : la clôture verse un crédit ou crée une facture de supplément selon les badges réellement imprimés.
:::

:::permission print.sheets.generate
- **Générer les planches** (commande en amont Payée, En production ou Prête) : ouvre l'écran Planches pour cette commande.
:::

## Planche

Le bloc **Planche** indique l'état (**À générer**, **En cours**, **Prête** ou **Échec**), les chiffres (badges, feuilles, pages, recto-verso ou recto seul, gabarit) et le lien **Gérer dans Planches**. **Télécharger** et **Voir la planche** (aperçu PDF) apparaissent lorsque la planche est prête et que vous pouvez consulter les planches.

:::permission print.requests.credit.apply
## Crédit d'impression

Ce bloc affiche « Crédit disponible de l'organisation » et, le cas échéant, « Crédit appliqué à cette commande », puis le solde de l'organisation « Crédit d'impression » avec l'historique de ses mouvements. Tant que la commande est **Envoyée** ou **Devis envoyé** et que du crédit est disponible, **Appliquer le crédit** (ou **Modifier le crédit** si un crédit est déjà appliqué) ouvre « Appliquer le crédit d'impression » : **Montant (FCFA)** (entier d'au moins 1, plafonné au plus petit du crédit disponible et du total des lignes ; ce maximum est prérempli), puis **Appliquer** (« Crédit de … appliqué. »). Un avertissement s'affiche si le crédit appliqué dépasse le total des autres lignes : le devis ne peut alors pas être envoyé tant que le crédit n'est pas réduit.
:::

## Impression sur place

Pour une commande sur place, une fois payée, le bloc affiche le compteur « N / M badges imprimés » avec sa barre, le plafond et la marge, et un avertissement à 90 % de la commande, au-delà de la commande ou au plafond. Le bouton **Ouvrir le poste d'impression** (commande Payée, En production ou Prête) n'apparaît que si vous avez le droit d'opérer l'impression sur place de l'évènement.

:::permission print.onsite.margin.update
La **Marge d'impression** (commande Payée, En production ou Prête) se règle par **Marge (%)** (entier de 0 à 100) et **Motif** (3 caractères au moins, 500 au plus), puis **Enregistrer** (« Marge mise à jour »).
:::

:::permission payments.read
## Paiements

Le bloc **Paiements** liste les paiements FedaPay de la commande (**Date**, **Objet**, **Montant**, **Statut**, **Référence**), du plus récent au plus ancien. Il n'apparaît que s'il y a au moins un paiement.
:::
