---
route: /platform/jobs/[jobId]
title: Détail d'un envoi d'e-mail
audience: staff
access: email_jobs.read
sources:
  - src/app/platform/jobs/[jobId]/page.tsx
  - src/app/platform/jobs/_components/JobActions.tsx
  - src/app/platform/jobs/_components/JobStatusBadge.tsx
  - src/app/platform/page-guard.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/JournalBlocks.tsx
sourceHash: sha256:ee50eaa897880e4ecb422c8bbdf84ce3cbe0e2363634eae54ffd7aab9abb664c
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cette fiche détaille un envoi de la file d'e-mails. Le lien **Emails** en haut ramène à la liste. Le titre est le sujet de l'e-mail (ou son type à défaut).

## Détail de l'envoi

**Statut**, **Type**, **Destinataire**, **Sujet**, **Priorité** (Haute ou Normale), **Tentatives** (essais sur le maximum), **Prochain essai**, **Créé le** et **Terminé le**. Un envoi en cours affiche aussi son **Verrou**.

:::permission email_jobs.manage
## Relancer ou annuler

Dans l'en-tête du bloc, selon l'état de l'envoi :
- **Relancer** : disponible pour un envoi en échec ou annulé dont le contenu n'a pas été purgé (« Email relancé. »).
- **Annuler l'envoi** : disponible tant que l'envoi est en attente (« Envoi annulé. »).

Un envoi qui n'est ni relançable ni annulable n'affiche aucun bouton.
:::

## Dernière erreur

Le message d'erreur du dernier essai, lorsqu'il y en a un.

## Contenu

Aperçu de l'e-mail tel qu'il a été envoyé. Deux cas particuliers : « Contenu masqué : cet email contient un lien à usage unique. » pour les e-mails sensibles, et « Contenu purgé après envoi. » lorsque le contenu a été supprimé.
