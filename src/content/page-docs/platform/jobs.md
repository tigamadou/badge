---
route: /platform/jobs
title: Emails
audience: staff
access: email_jobs.read
sources:
  - src/app/platform/jobs/_components/JobStatusBadge.tsx
  - src/app/platform/jobs/page.tsx
  - src/app/platform/page-guard.ts
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/StatCard.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:8bd375fe6199769929605607f5aa630481b9d5028ea785e61beed4e9d9617b9d
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran montre la file d'envoi des e-mails de la plateforme : ce qui attend, ce qui a échoué et ce qui est parti.

## Les compteurs

- **En attente** : envois pas encore partis.
- **En échec** : envois qui n'ont pas abouti.
- **Envoyés (24 h)** : envois réussis sur les dernières 24 heures.

## Les filtres

Les filtres s'appliquent au clic sur **Filtrer** :
- **Statut** : **Tous** (par défaut), En attente, En cours, Envoyé, En échec ou Annulé. Un statut inconnu est ignoré avec le message « Statut inconnu : filtre ignoré. »
- **Type** : le type d'e-mail.
- **Du** et **Au** : bornes de dates.
- **Destinataire** : recherche sur le destinataire.

## Le tableau

Colonnes : **Date**, **Type** (masqué sur petit écran), **Destinataire**, **Statut**, **Tentatives** (essais effectués sur le maximum autorisé, par exemple 1/5 ; masqué sur petit écran), **Dernière erreur** (tronquée, le texte complet s'affiche au survol ; masqué sur petit écran) et une flèche « Voir le détail ». S'il n'y a rien, l'écran affiche « Aucun email ». La liste est paginée.
