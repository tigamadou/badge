---
route: /event/[eventId]/registrations/[regId]
title: Fiche d'une inscription
audience: organisateur
access: event.read.detailed
sources:
  - src/app/event/[eventId]/_lib/page-access.ts
  - src/app/event/[eventId]/registrations/[regId]/page.tsx
  - src/components/event/RegistrationActions.tsx
  - src/components/event/RegistrationDetailPanel.tsx
  - src/components/ui/ActionButton.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/DocumentPreview.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/FileBox.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/JournalBlocks.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/StatusBadge.tsx
sourceHash: sha256:5706e0cdc038a9711e512327d18776fb2320d40eeacd64acb077c58b19d4e4bd
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cette fiche présente une inscription : l'identité du participant, son statut, ses pièces et les actions de modération. Le lien **Inscriptions** en haut ramène à la liste. Une inscription qui n'appartient pas à cet évènement est introuvable.

## L'en-tête

Le nom du participant, son statut (**En attente**, **Approuvé** ou **Rejeté**) et l'étiquette **ALL ACCESS** si l'accès à toutes les zones est accordé ; en dessous, l'e-mail et la structure.

Pour une inscription rejetée, l'encadré **Motif de rejet** donne le motif et, le cas échéant, les détails saisis.

Le tableau d'informations indique :
- **Catégorie** (nom et numéro) ;
- **Pièce** (type et numéro) ;
- **Identité** : état de la vérification du profil par la plateforme (« Vérifiée par la plateforme le … », « Refusée par la plateforme » ou « En attente de vérification par la plateforme ») ;
- **Inscrit le** ;
- **Badge imprimé le**, lorsque le badge a été imprimé.

:::permission registration.approve
## Approuver ou rejeter

Pour une inscription **En attente** :
- **Approuver** approuve l'inscription (« Inscription approuvée. »). Le bouton est désactivé tant que le profil n'est pas validé par la plateforme (« Profil non validé par la plateforme »).
- **Rejeter / Bloquer** ouvre la fenêtre **Rejeter cette inscription** : choisissez un motif dans la liste (« Sélectionner un motif… », obligatoire), ajoutez si vous le souhaitez des **Détails complémentaires (optionnel)** (2 000 caractères maximum), puis **Rejeter** (« Inscription rejetée. »). **Annuler** referme la fenêtre. Cette fenêtre rejette l'inscription ; pour bloquer l'e-mail ou le document, utilisez les actions avancées.

Une inscription déjà approuvée dont le badge a été imprimé ne peut plus être rejetée.
:::

:::permission badge.print
## Marquer le badge imprimé

Pour une inscription **Approuvé**, le bouton **Marquer imprimé** enregistre le badge comme imprimé (« Badge marqué imprimé. »). Le bouton **Voir le badge** des actions avancées ouvre la fiche du badge.
:::

## Pièces fournies

La carte affiche la **Photo** du participant. La **Pièce d'identité** n'est montrée que si votre accès le permet ; sinon, seule la carte **Photo** est présentée.

## Actions avancées

:::permission registration.all_access
**Activer ALL ACCESS** accorde l'accès à toutes les zones (« Accès ALL ACCESS accordé. ») ; **Retirer ALL ACCESS** le retire.
:::

:::permission registration.block
**Bloquer cet e-mail** et **Bloquer ce document** ajoutent respectivement l'adresse ou le numéro de pièce aux listes de blocage de l'évènement, après confirmation (« E-mail bloqué. », « Document bloqué. »), avec le motif « Bloqué via le détail inscription ».
:::

:::permission registration.delete
**Supprimer** supprime définitivement l'inscription après confirmation (« Inscription supprimée. »), puis ramène à la liste.
:::
