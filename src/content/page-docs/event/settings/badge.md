---
route: /event/[eventId]/settings/badge
title: Modèle de badge
audience: organisateur
access: event.settings.update
sources:
  - src/app/event/[eventId]/_lib/page-access.ts
  - src/app/event/[eventId]/settings/badge/page.tsx
  - src/components/admin/BadgeTemplatePicker.tsx
  - src/components/event/EventImageAlert.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/TemplatePreview.tsx
sourceHash: sha256:a3c2c990534614e024deac13d93bbc1c4b62de6c38766b891d0fdfbcfba00860
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran choisit le modèle utilisé pour imprimer les badges de l'évènement. À défaut de choix, l'évènement hérite du modèle de l'organisation, ou à défaut de celui de la plateforme.

## Images à recadrer

Si le logo ou la bannière de l'évènement ne respecte pas le cadre du modèle effectif, le bandeau **Images à recadrer** les liste ; la génération des badges est bloquée tant qu'elles ne sont pas conformes. Le lien **Recadrer dans les paramètres** ouvre les paramètres de l'évènement.

## Modèle effectif

La ligne « Template effectif » indique l'identifiant du modèle réellement utilisé et le niveau dont il provient (évènement, organisation ou plateforme). Le bouton **Utiliser le défaut hérité** (visible seulement si l'évènement a un modèle propre) retire ce choix pour revenir au modèle de l'organisation ou de la plateforme.

## Les modèles

Chaque carte présente un aperçu, le nom du modèle, son format et son nombre de pages, et sa description. Une icône d'imprimante signale un modèle adapté à l'impression sur place (« Impression sur place »). Le modèle choisi pour l'évènement porte la mention **Sélectionné**. Sur les autres cartes, **Sélectionner** enregistre le modèle pour l'évènement (« Template enregistré. »). La mention **Hérité à ce niveau** indique le modèle effectif hérité d'un niveau supérieur.

## Verrouillage

Lorsqu'une commande d'impression de l'évènement a été payée, le modèle est verrouillé : un encadré le précise avec la référence de la commande, et les boutons sont désactivés. Il redevient modifiable quand la commande est terminée.
