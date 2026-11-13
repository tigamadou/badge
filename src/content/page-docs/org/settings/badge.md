---
route: /org/[orgId]/settings/badge
title: Modèle de badge
audience: organisateur
access: org.badge_settings.update
sources:
  - src/app/org/[orgId]/_lib/page-access.ts
  - src/app/org/[orgId]/settings/badge/page.tsx
  - src/components/admin/BadgeTemplatePicker.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/TemplatePreview.tsx
sourceHash: sha256:ff4f16ab857badf0223bed5d04ebc5421bb816b5fec051362de0277e6fc59247
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran choisit le modèle de badge appliqué par défaut aux évènements de votre organisation. Chaque évènement peut ensuite le remplacer dans ses propres paramètres.

## Le modèle effectif

Un bandeau indique le « Template effectif » et son niveau : **organisation** si vous avez choisi un modèle, **plateforme** si l'organisation hérite du modèle par défaut de la plateforme.

Lorsqu'un modèle est choisi pour l'organisation, le bouton **Utiliser le défaut hérité** supprime ce choix et revient au modèle de la plateforme.

## Les modèles proposés

Chaque carte montre l'aperçu du modèle, son nom, son format et son nombre de pages, sa description, et une icône d'imprimante lorsqu'il permet l'impression sur place. Le bouton **Sélectionner** retient ce modèle (« Template enregistré. ») ; le modèle retenu est signalé « Sélectionné ». La mention « Hérité à ce niveau » apparaît sur le modèle effectif qui n'a pas été choisi explicitement.
