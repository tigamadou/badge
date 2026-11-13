---
route: /platform/badge-templates/[id]
title: Détail d'un template de badge
audience: staff
access: badge_templates.read
sources:
  - src/app/platform/badge-templates/[id]/page.tsx
  - src/app/platform/page-guard.ts
  - src/components/staff/ManifestDownloadButton.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/TemplatePreview.tsx
sourceHash: sha256:62b7400cd790a98c634742cd38f702a624c2faa259a1bd7b37d8dc7d31df7bd0
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cette fiche présente une version installée d'un template de badge. Le lien **Templates de badge** en haut ramène au catalogue. Elle est en lecture seule : l'archivage se fait depuis le catalogue.

## L'en-tête

Le nom du template, son état (**Disponible** ou **Archivé**), puis sa famille, sa version, son nombre de pages, ses dimensions en pixels, sa date d'installation et sa description si elle existe.

## Aperçu

Le rendu réel du badge, aux dimensions exactes. **Ouvrir en plein écran** l'ouvre dans un nouvel onglet lorsqu'un aperçu est disponible.

## Utilisé par

Indique où cette version est utilisée : **Défaut de la plateforme** (racine de la cascade de choix du modèle), les organisations et les évènements concernés (un clic sur une organisation ouvre sa fiche). Si rien ne l'utilise, l'écran précise que la version peut être archivée sans conséquence.

## Versions de la famille

Liste toutes les versions de la même famille avec leur date, la mention « archivée » le cas échéant, « version affichée » pour la version courante, et un lien **Voir** vers les autres.

## Ressources embarquées

Les fichiers fournis par le paquet (images, polices) avec leur taille en ko. Le bloc n'apparaît que s'il y en a.

## Manifeste

Le manifeste du template en JSON. **Télécharger le manifeste** l'enregistre dans un fichier nommé d'après la famille et la version.
