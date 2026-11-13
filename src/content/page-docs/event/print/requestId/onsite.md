---
route: /event/[eventId]/print/[requestId]/onsite
title: Poste d'impression
audience: staff
access: print.onsite.operate
sources:
  - src/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/onsite/_scope.ts
  - src/app/event/[eventId]/_lib/page-access.ts
  - src/app/event/[eventId]/print/[requestId]/onsite/page.tsx
  - src/components/badge/BadgeDocumentView.tsx
  - src/components/event/QrCamera.tsx
  - src/components/event/ScannerFrame.tsx
  - src/components/print/OnsiteCounterCard.tsx
  - src/components/staff/print/OnsiteStation.tsx
  - src/components/staff/print/request-fetch.ts
  - src/components/ui/Button.tsx
  - src/components/ui/DocumentPreview.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/FileBox.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Input.tsx
  - src/components/ui/Labels.tsx
sourceHash: sha256:0681a40928698c5f167644db6085e9e3bf62e91fa777d839410eea5cfbe40457
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Le poste d'impression sert à imprimer sur place le badge d'un participant déjà approuvé. Il identifie le participant, affiche son badge et lance l'impression ; il n'inscrit et n'approuve personne. Le lien **← Commande …** en haut ramène à la liste des commandes du poste. Si l'évènement est archivé ou si la commande n'est plus imprimable, vous revenez à cette liste.

## L'en-tête

Le titre « Poste d'impression · » suivi de la référence, le nom de l'évènement et le lieu d'impression, et, si l'équipe Badge en a renseigné une, la mention « Imprimante : » avec la note correspondante.

## Compteur

La carte de compteur affiche « n / m badges imprimés » (imprimés sur commandés), le plafond et la marge, une barre de progression et des alertes : « 90 % de la commande atteinte », puis le nombre de badges au-delà de la commande (facturés après l'évènement), puis « Plafond atteint : l'impression est bloquée ».

## Identifier un participant

- **Caméra** : active par défaut, elle lit le QR d'accueil du participant ; **Désactiver la caméra** / **Activer la caméra** la coupe ou la rallume.
- **Recherche** : saisissez un nom, un e-mail, un identifiant ou le contenu d'un QR (au moins 2 caractères) puis **Rechercher**. Les résultats affichent le nom, l'e-mail et la mention « Déjà imprimé » le cas échéant ; cliquer sur un résultat ouvre sa fiche. « Aucun résultat. » si rien ne correspond.

Tant qu'aucune fiche n'est ouverte, l'écran invite à scanner le QR d'accueil d'un participant ou à le rechercher. Un participant refusé s'affiche en alerte, par exemple « Inscription non approuvée (en attente) : le poste n'approuve personne. »

## La fiche et l'impression

La fiche montre la photo, le nom, l'e-mail, la catégorie et l'aperçu du badge.
- **Imprimer** : prépare le badge, l'ouvre dans un nouvel onglet pour l'imprimer et l'ajoute au compteur (« Badge envoyé à l'impression »). Le lien **Ouvrir le PDF** permet de le rouvrir. Le bouton est désactivé quand le plafond est atteint (« Plafond atteint : seules les réimpressions restent possibles. »).
- Si le badge a déjà été imprimé hors du poste, un avertissement précise que cette impression sera comptée.
- Si le badge a déjà été imprimé à ce poste, la fiche indique « Déjà imprimé le … » et propose **Réimprimer**, qui n'est pas comptée.
