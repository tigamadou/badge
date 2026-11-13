---
route: /platform/print/orders/[requestId]/onsite
title: Poste d'impression sur place
audience: staff
access: platform.access
sources:
  - src/app/platform/page-guard.ts
  - src/app/platform/print/orders/[requestId]/onsite/page.tsx
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
sourceHash: sha256:eb67af2481e949c7b998319de8c8d307a6fc29861bab8c283dad1401c9221f2a
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Le poste d'impression sert, pendant l'évènement, à identifier un participant déjà approuvé et à imprimer son badge. Il n'inscrit et n'approuve personne. Il n'est ouvert que pour une commande sur place payée, en production ou prête : sinon vous revenez à la fiche de la commande. Vous devez aussi avoir le droit d'opérer l'impression sur place de l'évènement ; sans lui, vous êtes renvoyé à la fiche de la commande.

## L'en-tête

Le lien **← Commande** (avec sa référence) ramène à la fiche. Le titre « Poste d'impression · référence » est suivi de l'évènement, du lieu et, s'il est renseigné, de la mention « Imprimante : … ».

## Le compteur

Il affiche « N / M badges imprimés » avec une barre de progression, le plafond et la marge. Un avertissement apparaît à 90 % de la commande, lorsque des badges dépassent la commande (ils sont facturés après l'évènement) et au plafond, où l'impression est bloquée : seules les réimpressions restent possibles.

## Identifier un participant

- **Caméra** : « Caméra active » par défaut ; **Désactiver la caméra** / **Activer la caméra**. Scanner le QR d'accueil d'un participant ouvre sa fiche.
- **Nom, email, ID ou contenu du QR** : saisissez au moins deux caractères puis **Rechercher**. Si la saisie contient une adresse de vérification de QR, elle est lue comme un QR. Les résultats listent nom et e-mail, avec « Déjà imprimé » le cas échéant ; cliquez sur un résultat pour ouvrir sa fiche. « Aucun résultat. » sinon.

Un refus s'affiche dans un encadré, par exemple « Inscription non approuvée … : le poste n'approuve personne. » Tant qu'aucune fiche n'est ouverte : « Scannez le QR d'accueil d'un participant ou recherchez-le. »

## La fiche du participant

Photo, nom, e-mail, catégorie et aperçu du badge. Selon l'état :
- **Imprimer** : lance l'impression. Le badge s'ouvre dans un nouvel onglet (« Badge envoyé à l'impression ») ; **Ouvrir le PDF** le rouvre.
- Badge déjà imprimé hors du poste : un avertissement précise que cette impression sera comptée.
- Badge déjà imprimé au poste : **Réimprimer** (non comptée).
- Au plafond : « Plafond atteint : seules les réimpressions restent possibles. »
