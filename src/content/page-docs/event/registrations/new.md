---
route: /event/[eventId]/registrations/new
title: Inscription manuelle
audience: organisateur
access: registration.create
sources:
  - src/app/event/[eventId]/_lib/page-access.ts
  - src/app/event/[eventId]/registrations/new/page.tsx
  - src/components/account/IdPhotoRules.tsx
  - src/components/event/RegistrationForm.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Dialog.tsx
  - src/components/ui/FileBox.tsx
  - src/components/ui/FormControls.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/ImageCropper.tsx
  - src/components/ui/Input.tsx
  - src/components/ui/RadioCards.tsx
sourceHash: sha256:a65ece184b9e61d60e92d8a0c33ad0b3915f6e5d89e364e6f87e2e000a297452
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran crée directement une inscription pour un participant, sans passer par le lien d'inscription public. Une fois l'inscription créée, la fiche de l'inscription s'ouvre.

## Identité

- **Prénom** et **Nom** (obligatoires) ;
- **Adresse e-mail** (obligatoire) ;
- **Structure / organisation** (obligatoire).

## Catégorie

Choisissez la catégorie du participant parmi les catégories de l'évènement, présentées sous la forme « #numéro — nom ». La première est sélectionnée par défaut.

## Pièce d'identité

- **Type** : **CNI** (par défaut), **Passeport**, **Permis de conduire** ou **Autre** ;
- **Numéro de pièce** (obligatoire) ;
- **Photo** : déposez un fichier (JPEG, PNG ou WebP, 5 Mo maximum) ; les règles de la photo d'identité s'affichent au-dessus, et la photo est recadrée avant l'envoi (« Recadrer la photo »). Une fois la photo envoyée, **Recadrer** la reprend et **Retirer** la supprime ;
- **Pièce d'identité** : déposez la pièce (JPEG, PNG, WebP ou PDF, 5 Mo maximum) ; **Retirer** la supprime.

## Créer l'inscription

Le bouton **Créer l'inscription** enregistre l'inscription. Un champ invalide est signalé par « Valeur invalide. » sous le champ. Si la personne est déjà inscrite à l'évènement, le message « Cette personne est déjà inscrite à cet événement. » s'affiche ; en cas d'autre échec : « Échec de l'enregistrement. »
