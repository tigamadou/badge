---
route: /event/[eventId]/badges/print
title: Impression par lot
audience: staff
access: badge.print
sources:
  - src/app/event/[eventId]/_lib/page-access.ts
  - src/app/event/[eventId]/badges/print/page.tsx
  - src/components/badge/BadgeDocumentView.tsx
  - src/components/event/BadgeBatchLoader.tsx
  - src/components/event/BadgeBatchPanel.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Labels.tsx
sourceHash: sha256:ba011ffd784197b63e40952bf9f87229262db6eaf73b9a1466615e509606bd97
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran prépare l'impression d'une sélection de badges faite depuis la liste des badges (bouton **Aperçu PDF**). Il s'ouvre dans un nouvel onglet et affiche le nombre de badges à imprimer.

Si la sélection n'est plus disponible (page ouverte directement, ou stockage du navigateur indisponible), l'écran indique « Sélection introuvable : revenez à la liste des badges. » En cas d'échec de chargement : « Le chargement de la sélection a échoué. Rechargez la page. »

## Le lot

Seules les inscriptions approuvées sont retenues. Si certains identifiants de la sélection sont introuvables ou non approuvés, un avertissement l'indique (« n identifiant(s) ignoré(s) : introuvables ou non approuvés. »). Sans aucun badge, l'écran affiche « Aucun badge à imprimer. »

La carte **Badges du lot** liste chaque badge avec son nom (« Identité masquée » pour une catégorie anonyme), son numéro, sa catégorie et la mention « Imprimé » s'il l'est déjà. Cliquer sur une ligne affiche l'aperçu du badge à droite.

## Les actions

- **Préparer le ZIP** : lance la préparation d'un fichier ZIP contenant un PDF par badge. Pendant la préparation, l'écran affiche « Préparation… » avec le nombre de badges ; vous pouvez recharger la page, le suivi reprend. Si la préparation tarde, un message précise que vous pouvez fermer la page et revenir plus tard. Une fois prêt, le bouton devient **Télécharger le ZIP**. En cas d'échec, le message d'erreur s'affiche.
- **Marquer imprimés** : marque tous les badges du lot comme imprimés (« n badge(s) marqué(s) imprimé(s). »). Le marquage se fait par paquets ; s'il s'interrompt, le message indique combien de badges ont été marqués, et un nouvel essai ne reprend que le reste. Ce bouton est désactivé si l'évènement est archivé (« Événement archivé : le marquage est désactivé. »).

Le marquage enregistre que les badges ont été imprimés et peut déclencher les notifications et e-mails de badge imprimé prévus pour les participants.
