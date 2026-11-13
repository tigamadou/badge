---
route: /event/[eventId]/print/[requestId]
title: Commande d'impression
audience: organisateur
access: print.request
sources:
  - src/app/event/[eventId]/print/[requestId]/page.tsx
  - src/components/admin/PaymentHistory.tsx
  - src/components/event/print/PrintPayButton.tsx
  - src/components/event/print/PrintRequestActions.tsx
  - src/components/event/print/guard.ts
  - src/components/event/print/order/OrganizerComposer.tsx
  - src/components/event/print/order/OrganizerConversation.tsx
  - src/components/event/print/order/OrganizerOrderLayout.tsx
  - src/components/event/print/order/OrganizerOrderSummary.tsx
  - src/components/event/print/order/OrganizerQuoteColumn.tsx
  - src/components/event/print/order/thread-sync.ts
  - src/components/event/print/pay-button.ts
  - src/components/layout/FullHeightPage.tsx
  - src/components/payments/status.ts
  - src/components/print/OnsiteCounterCard.tsx
  - src/components/print/OnsiteTemplateAlert.tsx
  - src/components/print/OrderBadgesDialog.tsx
  - src/components/print/OrderModal.tsx
  - src/components/print/OrderTabs.tsx
  - src/components/print/PrintRequestStatusBadge.tsx
  - src/components/print/PrintThread.tsx
  - src/components/print/QuoteMessageCard.tsx
  - src/components/print/QuoteTotals.tsx
  - src/components/print/RelatedRequestLinks.tsx
  - src/components/print/entry-tone.ts
  - src/components/print/quote-message.ts
  - src/components/print/useIsWide.ts
  - src/components/staff/print/order/OrderBadgesButton.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Dialog.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/Table.tsx
  - src/components/ui/TableFrame.tsx
  - src/components/ui/Timeline.tsx
sourceHash: sha256:e8ca1c2cc5c5d9ced1c18920f8edfcfe8392ffb995006029044a2672433be158
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cette page suit une commande d'impression : son état, ses informations, les échanges avec l'équipe Badge, le devis et les paiements. Le lien **Impression** en haut ramène à la liste. Les actions décrites plus bas ne sont pas proposées au staff de la plateforme en consultation, qui ne peut ni modifier, ni accepter, ni annuler, ni écrire.

## L'en-tête

Le titre « Commande d'impression » suivi de la référence, et son statut (Brouillon, Envoyée, Devis envoyé, Devis accepté, Payée, En production, Prête, Terminée, Refusée ou Annulée). Une commande complémentaire ou principale est reliée par des liens (« Complément de … », « Commande complémentaire … »).

Boutons d'action, selon le statut :
- **Voir les badges (n)** : pour une commande en amont, liste paginée des badges de la commande (nom, catégorie, statut de l'inscription, imprimé oui/non), avec recherche par nom.
- **Modifier** : ouvre l'assistant de modification, tant que la commande est un brouillon, envoyée ou en devis et que l'évènement n'est pas archivé.
- **Accepter le devis vN** : accepte le devis envoyé (« Devis accepté. »). Seul le propriétaire de l'organisation le peut ; sinon le message « Seul le propriétaire de l'organisation peut accepter ce devis. » s'affiche.
- **Annuler la commande** : disponible jusqu'au statut Devis accepté ; après confirmation (« Voulez-vous vraiment annuler cette commande d'impression ? Les badges réservés seront libérés. »), la commande passe à Annulée. **Garder la commande** referme la fenêtre.
- **Payer** (avec le montant en FCFA) : une fois le devis accepté, ouvre la page de paiement FedaPay. Seul le propriétaire de l'organisation peut payer. Si un paiement est déjà en cours, la mention « Un paiement est en cours. Vous pouvez le reprendre. » s'affiche. Le bouton n'apparaît pas lorsque le montant est nul : un devis entièrement couvert par le crédit d'impression passe directement à Payée.

## Colonne Infos

Le résumé de la commande : référence, statut, **Type**, **Badges**, puis pour une commande en amont le **Mode de remise**, l'**Adresse de livraison**, le **Contact**, le **Téléphone** et la **Date souhaitée** ; pour une commande sur place le **Lieu d'impression**, le **Contact sur place**, le **Téléphone** et les **Créneaux de présence** ; les **Remarques** et le **Total**.

Au-dessus, selon le cas :
- une alerte indiquant le crédit d'impression disponible, tant que la commande est envoyée ou en devis ;
- pour une commande sur place, une alerte si le modèle de badge n'est plus adapté à l'impression sur place (l'équipe Badge ne peut pas avancer la commande), avec le lien **Changer le modèle de badge** ;
- pour une commande sur place payée, le compteur d'impression (« n / m badges imprimés », plafond et marge, barre de progression et alertes à 90 % de la commande, au-delà de la commande, et à l'atteinte du plafond).

## Colonne Discussion

Les échanges avec l'équipe Badge : vos messages à droite, ceux de l'« Équipe Badge » à gauche, et des évènements automatiques (envoi, devis, changements) au centre. Les nouveaux messages arrivent seuls toutes les 10 secondes ; si vous avez fait défiler vers le haut, le bouton **Nouveaux messages** vous ramène en bas. Sans échange : « Aucun échange pour le moment. »

Pour écrire (sauf sur un brouillon) : saisissez le message (« Écrire un message à l'équipe Badge… », 5 000 caractères maximum), éventuellement **Joindre un fichier** (JPEG, PNG, WebP ou PDF) puis **Envoyer**. Ouvrir cette page marque les messages comme lus.

## Colonne Devis

La carte **Devis vN** (ou **Lignes de la commande** avant le premier devis) affiche le **Total estimé** et le nombre de lignes et de badges. Le prix définitif est fixé par l'équipe Badge dans le devis. La carte **Paiements** liste les paiements (date, objet, montant, statut, référence).

Sur écran étroit, les trois colonnes deviennent trois onglets : **Infos**, **Discussion** (par défaut) et **Devis**.
