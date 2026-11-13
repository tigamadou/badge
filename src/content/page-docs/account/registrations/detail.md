---
route: /account/registrations/[id]
title: Détail d'une inscription
audience: participant
sources:
  - src/app/account/registrations/[id]/ResubmitButton.tsx
  - src/app/account/registrations/[id]/page.tsx
  - src/components/event/EventCover.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/DocumentPreview.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/FileBox.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/JournalBlocks.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/RadioCards.tsx
  - src/components/ui/StatusBadge.tsx
sourceHash: sha256:4828022667aaff376b57884a3d96f21d12c2a112a8b1cbdb50f0ceb7f0a2f74a
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran présente une de vos inscriptions : l'évènement, son statut, les informations enregistrées au moment de l'inscription et, selon le cas, votre QR d'accueil ou les actions à mener après un rejet. Seul le titulaire de l'inscription y a accès ; sinon vous êtes renvoyé vers **Mes inscriptions**.

## En-tête

La bannière de l'évènement, le lien **Retour** vers vos inscriptions, le titre, le statut (**En attente**, **Validé** ou **Rejeté**), puis la date et le lieu de l'évènement.

## Messages d'état

- **Inscription en attente de validation du profil** : affiché lorsque l'inscription est en attente et que votre profil n'est pas encore validé. L'organisateur n'examinera l'inscription qu'une fois la vérification de vos pièces terminée ; le lien **Voir mon profil** ouvre votre profil.
- **Badge imprimé le …** : affiché pour une inscription validée dont le badge a été imprimé.

## QR d'accueil

Pour une inscription validée, un QR code est affiché avec l'identifiant de l'inscription. Présentez-le à l'accueil, sur votre téléphone ou imprimé.

## Inscription rejetée

Pour une inscription rejetée, l'écran affiche « Inscription rejetée » avec le motif et les précisions éventuelles. Vous pouvez :

- cliquer sur **Modifier mon profil** pour corriger vos informations ;
- choisir une autre **Catégorie** parmi celles de l'évènement (la catégorie actuelle est présélectionnée ; si vous en changez, un message précise la catégorie dans laquelle l'inscription sera resoumise) ;
- cliquer sur **Resoumettre mon inscription** (« Inscription resoumise. »). Les informations enregistrées sont alors réécrites avec les valeurs actuelles de votre profil. En cas de changement de catégorie, vous êtes redirigé vers la nouvelle fiche d'inscription.

## Informations enregistrées pour cette inscription

Une copie figée de vos informations au moment de l'inscription : **Catégorie**, **Nom**, **E-mail**, **Structure**, **Pièce** (type et numéro) et **Inscrit le**.

## Pièces fournies

Les aperçus de la **Photo** et de la **Pièce d'identité** jointes à l'inscription.

## Questions fréquentes

**Pourquoi mes informations ne changent-elles pas après modification du profil ?** Cette fiche conserve les valeurs d'origine ; elles ne sont mises à jour qu'en cas de resoumission d'une inscription rejetée.
