---
route: /event/[eventId]/blocked-emails
title: Listes de blocage
audience: staff
access: registration.block
sources:
  - src/app/event/[eventId]/_lib/page-access.ts
  - src/app/event/[eventId]/blocked-emails/page.tsx
  - src/components/event/BlockedDocumentsForm.tsx
  - src/components/event/BlockedEmailsForm.tsx
  - src/components/event/BlocklistTabs.tsx
  - src/components/ui/ActionButton.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Input.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/TableFrame.tsx
  - src/components/ui/Tabs.tsx
sourceHash: sha256:f5a7a73c15e35c7da0bdaf84f406d35de5f830c88d0cee397bc173bfd07ae16b
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Les listes de blocage empêchent certaines personnes de s'inscrire à l'évènement : par adresse e-mail, ou par numéro de pièce d'identité. Deux onglets, **E-mails** et **Documents**, portent chacun une pastille avec le nombre d'entrées de la liste. L'onglet actif est conservé dans l'adresse de la page ; chaque liste a sa propre pagination.

## L'onglet E-mails

Le formulaire du haut ajoute une adresse à bloquer :
- **E-mail à bloquer** (obligatoire) ;
- **Raison (optionnelle)** ;
- le bouton **Bloquer** ajoute l'adresse (« E-mail bloqué. »). Si elle l'est déjà, le champ affiche « Cet e-mail est déjà bloqué. »

Le tableau liste les adresses : colonnes **E-mail**, **Raison** (« — » si vide) et **Depuis** (date de l'ajout). L'icône corbeille (« Retirer ») supprime l'adresse de la liste après confirmation (« Retirer cet email de la liste de blocage ? »). S'il n'y a aucune entrée : « Aucun e-mail bloqué. »

## L'onglet Documents

Même principe avec un numéro de pièce :
- **Numéro de pièce à bloquer** (obligatoire) ;
- **Raison (optionnelle)** ;
- **Bloquer** (« Document bloqué. » ; si déjà présent : « Ce document est déjà bloqué. »).

Le tableau a pour colonnes **Document**, **Raison** et **Depuis**. L'icône corbeille retire le document après confirmation (« Retirer ce document de la liste de blocage ? »). S'il n'y en a aucun : « Aucun document bloqué. »
