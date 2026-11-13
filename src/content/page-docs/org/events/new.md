---
route: /org/[orgId]/events/new
title: Nouvel événement
audience: organisateur
access: org.events.create
sources:
  - src/app/org/[orgId]/_lib/page-access.ts
  - src/app/org/[orgId]/events/new/page.tsx
  - src/components/admin/BadgeTemplatePicker.tsx
  - src/components/admin/BadgeTemplateTiles.tsx
  - src/components/admin/EventCreationWizard.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/FormControls.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Input.tsx
  - src/components/ui/JournalBlocks.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/Stepper.tsx
  - src/components/ui/Tabs.tsx
  - src/components/ui/TemplatePreview.tsx
sourceHash: sha256:6292db6743969b36e217cb077d954666e73d895f87e3668253ce7733bec76a5f
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet assistant crée un évènement pour votre organisation en quatre étapes : **Informations**, **Badge**, **Catégories** et **Récapitulatif**. Si votre abonnement ne permet pas la création d'évènement, vous êtes ramené à la liste des évènements.

## Étape 1 : Informations

- **Titre** (obligatoire).
- **Date** (obligatoire) et **Date de fin (optionnelle)**. La date de fin doit être postérieure ou égale à la date de l'évènement, sinon une erreur s'affiche sur le champ.
- **Lieu** (obligatoire).
- **Description (optionnelle)**.
- **Slug (URL publique)** : suggéré automatiquement à partir du titre tant que vous ne le modifiez pas. Si le slug existe déjà, vous obtenez l'erreur « Ce slug est déjà utilisé » et l'assistant revient à cette étape.

Le bouton **Continuer** reste inactif tant que le titre, la date et le lieu ne sont pas renseignés.

## Étape 2 : Badge

Choisissez le modèle imprimé sur les badges de l'évènement parmi les modèles proposés. Si vous n'en choisissez pas, l'évènement hérite du modèle de l'organisation, ou à défaut de celui de la plateforme (le nom du modèle hérité est indiqué). Vous pourrez le changer plus tard dans les paramètres de l'évènement.

## Étape 3 : Catégories

Deux modes, au choix :
- **Depuis un modèle** : cochez des modèles de catégories de l'organisation (nom, couleur et numéro affichés). S'il n'y en a pas, l'écran vous invite à en créer dans les modèles de catégories ou à passer en manuel.
- **Manuelles** : **Ajouter une catégorie**, puis saisissez son nom, choisissez sa couleur (par défaut bleu) et son numéro.

## Étape 4 : Récapitulatif

Le récapitulatif rappelle titre, date, lieu, slug (« (auto) » s'il est vide), modèle de badge et nombre de catégories. Le bouton **Créer l'événement** valide. L'évènement est créé avec les **inscriptions fermées** ; vous les ouvrirez depuis sa page de configuration, où vous êtes redirigé après la création.

## Questions fréquentes

**Pourquoi la création est-elle refusée ?** Un message indique soit que la limite d'évènements du plan est atteinte, soit que votre abonnement n'est pas actif. Dans les deux cas, contactez le support.
